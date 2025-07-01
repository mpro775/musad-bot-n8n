# extractor.py
import re
import json
import requests
from fastapi import HTTPException
from bs4 import BeautifulSoup
from trafilatura import fetch_url, extract as traf_extract
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

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
    2) إذا لم نجد JSON-LD أو og:title أو product:price → ننزل الصفحة عبر Playwright
    """
    try:
        res = requests.get(url, timeout=30, headers=DEFAULT_HEADERS)
        res.encoding = 'utf-8'
        html = res.text or ""
        # إذا الصفحة لا تحتوي على أي دلالات لبيانات المنتج
        if not any(marker in html for marker in [
            '<script type="application/ld+json"',
            'og:title',
            'product:price:amount',
        ]):
            raise HTTPException(status_code=204, detail="No product markers in HTML")
        res.raise_for_status()
        return html

    except Exception:
        # تحميل ديناميكي عبر Playwright
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(user_agent=DEFAULT_HEADERS["User-Agent"])
                page.goto(url, wait_until="networkidle", timeout=60000)
                html = page.content()
                browser.close()
                return html
        except PlaywrightTimeoutError as e:
            raise HTTPException(status_code=504, detail=f"Playwright timeout: {e}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Fetch error: {e}")

def extract_structured(html: str):
    soup = BeautifulSoup(html, "html.parser")
    # JSON-LD
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except:
            continue
        items = data.get('@graph') or (data if isinstance(data, list) else [data])
        for item in items:
            if item.get('@type') == "Product":
                offers = item.get('offers') or {}
                if isinstance(offers, list): offers = offers[0]
                price = offers.get('price')
                availability = offers.get('availability')
                images = item.get('image') or []
                if isinstance(images, str): images = [images]
                return {
                    "name": item.get("name"),
                    "description": item.get("description"),
                    "images": images,
                    "price": float(price) if price else None,
                    "availability": availability.split('/')[-1] if availability else None,
                }
    # Microdata / itemprop
    name = soup.find(itemprop="name")
    if name:
        price = soup.find(itemprop="price")
        avail = soup.find(itemprop="availability")
        img   = soup.find(itemprop="image")
        desc  = soup.find(itemprop="description")
        return {
            "name": name.get_text(strip=True),
            "description": desc.get_text(strip=True) if desc else None,
            "images": [img["src"]] if img and img.get("src") else [],
            "price": float(price.get("content") or price.get_text(strip=True)) if price else None,
            "availability": avail.get("content").split('/')[-1] if avail and avail.get("content") else None,
        }
    return None

def extract_meta(soup: BeautifulSoup):
    def meta(keys):
        for k in keys:
            tag = soup.find("meta", property=k) or soup.find("meta", attrs={"name": k})
            if tag and tag.get("content"):
                return tag["content"]
        return None

    return {
        "name": meta(["og:title","twitter:title"]),
        "description": meta(["og:description","twitter:description"]),
        "images": [meta(["og:image","twitter:image"])] or [],
        "price": float(meta(["product:price:amount","og:price:amount"]) or 0) or None,
        "availability": (meta(["product:availability","og:availability"]) or "").split("/")[-1] or None,
    }

def regex_extract_price(text: str):
    m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:ريال|ر\.س|SAR|\$)', text)
    return float(m.group(1).replace(',', '')) if m else None

def regex_extract_availability(text: str):
    if re.search(r'\b(متوفر|in stock|available)\b', text, re.I): return "InStock"
    if re.search(r'\b(غير متوفر|نفد|out of stock)\b', text, re.I): return "OutOfStock"
    return None

def debug_list_ldjson(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    idx = 0
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except: continue
        items = data.get('@graph') or (data if isinstance(data, list) else [data])
        for item in items:
            print(f"[LD-JSON #{idx}] keys = {list(item.keys())}")
            idx += 1

def debug_list_itemprops(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    props = {}
    for tag in soup.find_all(attrs={"itemprop": True}):
        k = tag["itemprop"]
        props.setdefault(k, []).append(tag.get("content") or tag.get_text(strip=True))
    for k, v in props.items():
        print(f"[itemprop] {k}: {v[:3]}{'…' if len(v)>3 else ''}")

def debug_list_meta(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        if key and tag.get("content"):
            print(f"[meta] {key}: {tag['content']}")

def full_extract(url: str):
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    # 1) بنيوي
    prod = extract_structured(html)
    if prod: return prod

    # 2) ميتا
    meta = extract_meta(soup)
    if meta["name"] or meta["price"] is not None:
        return meta

    # 3) هيوريستيك
    text = soup.get_text(" ")
    price = regex_extract_price(text)
    avail = regex_extract_availability(text)
    if price is not None or avail:
        name = soup.h1.get_text(strip=True) if soup.h1 else meta["name"] or soup.title.string
        return {"name": name, "description": None, "images": meta["images"], "price": price, "availability": avail}

    # 4) Fallback كامل
    downloaded = fetch_url(url)
    desc = traf_extract(downloaded, include_images=True) or ""
    imgs = [i["src"] for i in soup.find_all("img") if i.get("src","").startswith("http")]
    return {"name": meta["name"] or soup.title.string, "description": desc, "images": imgs, "price": None, "availability": None}
