# extractor.py
import re
import json
import requests
from fastapi import HTTPException
from bs4 import BeautifulSoup
from trafilatura import fetch_url, extract as traf_extract
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# نجسّد أنفسنا كمستعرض Chrome لمنع حظر بعض المواقع
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    )
}

def fetch_html(url: str) -> str:
    """
    يجرب أولاً requests (+ UTF-8)، ثم يتراجع إلى Playwright عند 403 أو خطأ آخر.
    """
    try:
        res = requests.get(url, timeout=30, headers=DEFAULT_HEADERS)
        res.encoding = 'utf-8'
        if res.status_code == 403 or not res.text.strip():
            raise HTTPException(status_code=403, detail="Blocked or empty by requests")
        res.raise_for_status()
        return res.text
    except HTTPException:
        # fallback to Playwright
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(user_agent=DEFAULT_HEADERS["User-Agent"])
                page.goto(url, wait_until="networkidle", timeout=60000)
                html = page.content()
                browser.close()
                return html
        except PlaywrightTimeoutError as e:
            raise HTTPException(status_code=400, detail=f"Playwright timeout: {e}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Fetch error both methods: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fetch error: {e}")

def extract_structured(html: str):
    """
    يبحث في <script type="application/ld+json"> أو itemprop ويُرجع أول كائن Product إن وجد.
    """
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
                if isinstance(offers, list):
                    offers = offers[0]
                price = offers.get('price') or offers.get('priceSpecification', {}).get('price')
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

    # Microdata / itemprop
    name_tag = soup.find(itemprop="name")
    if name_tag:
        price_tag = soup.find(itemprop="price")
        avail_tag = soup.find(itemprop="availability")
        img_tag = soup.find(itemprop="image")
        desc_tag = soup.find(itemprop="description")
        return {
            "name": name_tag.get_text(strip=True),
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "images": [img_tag.get("src")] if img_tag and img_tag.get("src") else [],
            "price": float(price_tag.get("content") or price_tag.get_text(strip=True)) if price_tag else None,
            "availability": avail_tag.get("content").split('/')[-1] if avail_tag and avail_tag.get("content") else None,
        }

    return None

def extract_meta(soup: BeautifulSoup):
    """
    استخلاص البيانات من Meta Tags (OG & Twitter & product:price)
    """
    def meta(props):
        for p in props:
            tag = soup.find("meta", property=p) or soup.find("meta", attrs={"name": p})
            if tag and tag.get("content"):
                return tag["content"]
        return None

    name = meta(["og:title", "twitter:title"])
    desc = meta(["og:description", "twitter:description"])
    img = meta(["og:image", "twitter:image"])
    price = meta(["product:price:amount", "og:price:amount"])
    availability = meta(["product:availability", "og:availability"])

    return {
        "name": name,
        "description": desc,
        "images": [img] if img else [],
        "price": float(price) if price else None,
        "availability": availability.split('/')[-1] if availability else None,
    }

def regex_extract_price(text: str):
    m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:ريال|ر\.س|SAR|\$)', text)
    return float(m.group(1).replace(',', '')) if m else None

def regex_extract_availability(text: str):
    if re.search(r'\b(متوفر|in stock|available)\b', text, re.I):
        return "InStock"
    if re.search(r'\b(غير متوفر|نفد|out of stock)\b', text, re.I):
        return "OutOfStock"
    return None

def debug_list_ldjson(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    idx = 0
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except:
            continue
        items = data.get('@graph') or (data if isinstance(data, list) else [data])
        for item in items:
            print(f"[LD-JSON #{idx}] keys = {list(item.keys())}")
            idx += 1

def debug_list_itemprops(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    props = {}
    for tag in soup.find_all(attrs={"itemprop": True}):
        k = tag['itemprop']
        props.setdefault(k, []).append(tag.get("content") or tag.get_text(strip=True))
    for k, vals in props.items():
        print(f"[itemprop] {k}: {vals[:3]}{'…' if len(vals)>3 else ''}")

def debug_list_meta(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        if key and tag.get("content"):
            print(f"[meta] {key}: {tag['content']}")

def full_extract(url: str):
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    # 1) Structured data
    prod = extract_structured(html)
    if prod:
        return prod

    # 2) Meta Tags
    meta = extract_meta(soup)
    if meta["name"] or meta["price"] is not None:
        return meta

    # 3) Regex heuristic
    text = soup.get_text(separator=' ')
    price = regex_extract_price(text)
    availability = regex_extract_availability(text)
    if price is not None or availability:
        name = soup.h1.get_text(strip=True) if soup.h1 else (meta["name"] or soup.title.string)
        return {
            "name": name,
            "description": None,
            "images": meta["images"],
            "price": price,
            "availability": availability,
        }

    # 4) Trafilatura fallback
    downloaded = fetch_url(url)
    desc_text = traf_extract(downloaded, include_images=True) or ""
    imgs = [img.get("src") for img in soup.find_all("img") if img.get("src","").startswith("http")]
    return {
        "name": meta["name"] or soup.title.string,
        "description": desc_text,
        "images": imgs,
        "price": None,
        "availability": None,
    }
