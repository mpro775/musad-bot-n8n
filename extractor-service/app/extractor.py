# extractor.py

import re
import json
import requests
from fastapi import HTTPException
from bs4 import BeautifulSoup
from trafilatura import fetch_url, extract as traf_extract
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# تمثيل المتصفح لمنع الحظر
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    )
}


def fetch_html(url: str) -> str:
    """
    1) نجرب requests أولاً
    2) إذا الصفحة محمية أو خالية أو بدون مؤشرات منتج → ننزل الصفحة عبر Playwright
    """
    try:
        res = requests.get(url, timeout=30, headers=DEFAULT_HEADERS)
        res.encoding = 'utf-8'
        html = res.text or ""
        # إذا الصفحة هي تحدّي Cloudflare أو لا تحتوي على أي دلالات لبيانات المنتج
        if "Just a moment" in html or not any(marker in html for marker in [
            '<script type="application/ld+json"',
            '<script type="application/json"',
            'og:title',
            'product:price:amount',
        ]):
            raise HTTPException(status_code=204, detail="No product markers in HTML")
        res.raise_for_status()
        return html

    except Exception:
        # fallback to Playwright
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(user_agent=DEFAULT_HEADERS["User-Agent"])
                page.goto(url, wait_until="networkidle", timeout=60000)
                # نحاول انتظار أي مؤشر صفحة منتج
                try:
                    page.wait_for_selector(
                        'script[type="application/ld+json"], script[type="application/json"], script[id^="ProductJson-"], .product-details, .price, h1',
                        timeout=60000
                    )
                except PlaywrightTimeoutError:
                    pass
                html = page.content()
                browser.close()
                return html
        except PlaywrightTimeoutError as e:
            raise HTTPException(status_code=504, detail=f"Playwright timeout: {e}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Fetch error: {e}")


def extract_structured(html: str):
    """
    1) JSON-LD
    2) Shopify JSON via <script id="ProductJson-...">
    3) أي <script type="application/json"> يحتوي مفاتيح product
    4) OpenGraph / Twitter Card
    5) Microdata via itemprop
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1) JSON-LD
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except:
            continue
        items = data.get('@graph') or (data if isinstance(data, list) else [data])
        for item in items:
            if item.get('@type') == "Product":
                offers = item.get('offers') or {}
                if isinstance(offers, list):
                    offers = offers[0]
                price = offers.get('price')
                availability = offers.get('availability')
                images = item.get('image') or []
                if isinstance(images, str):
                    images = [images]
                return {
                    "name": item.get("name"),
                    "description": item.get("description"),
                    "images": images,
                    "price": float(price) if price else None,
                    "availability": availability.split('/')[-1] if availability else None,
                }

    # 2) Shopify JSON via id="ProductJson-..."
    shopify_tag = soup.find("script", id=re.compile(r"ProductJson-"))
    if shopify_tag and shopify_tag.string:
        try:
            prod_json = json.loads(shopify_tag.string)
            variant0 = prod_json.get("variants", [{}])[0]
            return {
                "name": prod_json.get("title"),
                "description": prod_json.get("body_html"),
                "images": prod_json.get("images", []),
                "price": float(variant0.get("price", 0)),
                "availability": "InStock" if variant0.get("available") else "OutOfStock",
            }
        except:
            pass

    # 3) Generic JSON fallback
    for tag in soup.find_all("script", type="application/json"):
        txt = tag.string or ""
        try:
            obj = json.loads(txt)
        except:
            continue
        if isinstance(obj, dict) and "title" in obj and "variants" in obj:
            variant0 = obj.get("variants", [{}])[0]
            return {
                "name": obj.get("title"),
                "description": obj.get("body_html"),
                "images": obj.get("images", []),
                "price": float(variant0.get("price", 0)),
                "availability": "InStock" if variant0.get("available") else "OutOfStock",
            }

    # 4) OpenGraph / Twitter Card
    og_title = soup.find("meta", property="og:title")
    price_meta = (
        soup.find("meta", property="product:price:amount")
        or soup.find("meta", property="og:price:amount")
    )
    if og_title or price_meta:
        og_desc = soup.find("meta", property="og:description")
        og_img = soup.find("meta", property="og:image")
        avail_meta = (
            soup.find("meta", property="product:availability")
            or soup.find("meta", property="og:availability")
        )
        return {
            "name": og_title["content"] if og_title else None,
            "description": og_desc["content"] if og_desc else None,
            "images": [og_img["content"]] if og_img else [],
            "price": float(price_meta["content"]) if price_meta and price_meta.get("content") else None,
            "availability": avail_meta["content"].split("/")[-1] if avail_meta and avail_meta.get("content") else None,
        }

    # 5) Microdata / itemprop
    name_tag = soup.find(itemprop="name")
    if name_tag:
        price_tag = soup.find(itemprop="price")
        avail_tag = soup.find(itemprop="availability")
        img_tag = soup.find(itemprop="image")
        desc_tag = soup.find(itemprop="description")
        return {
            "name": name_tag.get_text(strip=True),
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "images": [img_tag["src"]] if img_tag and img_tag.get("src") else [],
            "price": float(price_tag.get("content") or price_tag.get_text(strip=True)) if price_tag else None,
            "availability": avail_tag.get("content").split("/")[-1] if avail_tag and avail_tag.get("content") else None,
        }

    return None


def regex_extract_price(text: str):
    m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:ريال|ر\.س|SAR|\$)', text)
    return float(m.group(1).replace(',', '')) if m else None


def regex_extract_availability(text: str):
    if re.search(r'\b(متوفر|in stock|available)\b', text, re.I):
        return "InStock"
    if re.search(r'\b(غير متوفر|نفد|out of stock)\b', text, re.I):
        return "OutOfStock"
    return None


def extract_dynamic_with_playwright(url: str):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(user_agent=DEFAULT_HEADERS["User-Agent"])
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_selector(".product-details, .price, h1", timeout=60000)
        price_text = page.query_selector(".price").inner_text()
        name_text = page.query_selector("h1").inner_text()
        try:
            avail_text = page.query_selector(".availability").inner_text()
        except:
            avail_text = None
        browser.close()
        price = float(re.sub(r'[^\d.]', '', price_text))
        return {
            "name": name_text.strip(),
            "description": None,
            "images": [],
            "price": price,
            "availability": avail_text.strip() if avail_text else None,
        }


def full_extract(url: str):
    """
    الخطوات:
    1) بنيوي (JSON-LD, Shopify JSON, Generic JSON, OG/meta, microdata)
       — يصلح فقط إذا الاسم أو السعر موجود
    2) Meta-only fallback
    3) Regex heuristic
    4) ديناميكي Playwright إذا صفحة تحدي أو نتائج غير كافية
    5) Trafilatura كامل كآخر خيار
    """
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    # 1) Structured data (only if فيها اسم أو سعر)
    prod = extract_structured(html)
    if prod and (prod.get("name") or prod.get("price") is not None):
        return prod

    # 2) Meta Tags
    meta = {
        "name": None,
        "description": None,
        "images": [],
        "price": None,
        "availability": None,
    }
    def _meta(keys):
        for k in keys:
            tag = soup.find("meta", property=k) or soup.find("meta", attrs={"name": k})
            if tag and tag.get("content"):
                return tag["content"]
        return None

    meta = {
        "name": _meta(["og:title", "twitter:title"]),
        "description": _meta(["og:description", "twitter:description"]),
        "images": [_meta(["og:image", "twitter:image"])] if _meta(["og:image", "twitter:image"]) else [],
        "price": float(_meta(["product:price:amount", "og:price:amount"]) or 0) or None,
        "availability": (_meta(["product:availability", "og:availability"]) or "").split("/")[-1] or None,
    }
    if meta["name"] or meta["price"] is not None:
        return meta

    # 3) Regex heuristic
    text = soup.get_text(" ")
    price = regex_extract_price(text)
    availability = regex_extract_availability(text)
    if price is not None or availability:
        name = soup.h1.get_text(strip=True) if soup.h1 else meta["name"] or (soup.title.string if soup.title else None)
        return {
            "name": name,
            "description": None,
            "images": meta["images"],
            "price": price,
            "availability": availability,
        }

    # 4) ديناميكي Playwright عند صفحة تحدي أو بيانات غير كافية
    if "Just a moment" in html or (not meta["name"] and price is None and not availability):
        try:
            return extract_dynamic_with_playwright(url)
        except Exception:
            pass

    # 5) Fallback كامل عبر Trafilatura
    downloaded = fetch_url(url)
    desc = traf_extract(downloaded, include_images=True) or ""
    imgs = [i["src"] for i in soup.find_all("img") if i.get("src", "").startswith("http")]
    return {
        "name": meta["name"] or (soup.title.string if soup.title else None),
        "description": desc,
        "images": imgs,
        "price": None,
        "availability": None,
    }
