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

    # 1) JSON-LD
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except:
            continue

        # ندعم @graph أو كائن وحيد أو قائمة
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

    # 2) Microdata/itemprop
    name = soup.find(itemprop="name")
    price = soup.find(itemprop="price")
    avail = soup.find(itemprop="availability")
    img = soup.find(itemprop="image")
    if name:
        return {
            "name": name.get_text(strip=True),
            "description": soup.find(itemprop="description").get_text(strip=True) if soup.find(itemprop="description") else None,
            "images": [img.get("src")] if img and img.get("src") else [],
            "price": float(price.get("content") or price.get_text(strip=True)) if price else None,
            "availability": avail.get("content").split('/')[-1] if avail and avail.get("content") else None,
        }
    return None

def extract_meta(soup: BeautifulSoup):
    """
    استخلاص البيانات من Meta Tags (OG & Twitter & product:price)
    """
    def meta(prop_names):
        for prop in prop_names:
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if tag and tag.get("content"):
                return tag["content"]
        return None

    name = meta(["og:title","twitter:title"])
    desc = meta(["og:description","twitter:description"])
    img  = meta(["og:image","twitter:image"])
    price = meta(["product:price:amount","og:price:amount"])
    availability = meta(["product:availability","og:availability"])

    return {
        "name": name,
        "description": desc,
        "images": [img] if img else [],
        "price": float(price) if price else None,
        "availability": availability.split('/')[-1] if availability else None,
    }

def regex_extract_price(text: str):
    """
    يبحث في النص عن أول رقم مع رمز عملة.
    """
    m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:ريال|ر\.س|SAR|\$)', text)
    if m:
        return float(m.group(1).replace(',', ''))
    return None

def regex_extract_availability(text: str):
    """
    يبحث عن كلمات التوفر.
    """
    if re.search(r'\b(متوفر|in stock|available)\b', text, re.I):
        return "InStock"
    if re.search(r'\b(غير متوفر|نفد|out of stock)\b', text, re.I):
        return "OutOfStock"
    return None

def full_extract(url: str):
    """
    سير عمل متعدد الطبقات:
    1) جلب HTML
    2) JSON-LD / Microdata
    3) Meta Tags
    4) Regex-based Heuristics
    5) Trafilatura كـ fallback أخير
    """
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    # 2) Structured data
    structured = extract_structured(html)
    if structured:
        return structured

    # 3) Meta Tags
    meta = extract_meta(soup)
    if meta["name"] or meta["price"] is not None:
        return meta

    # 4) Heuristic text-based
    text = soup.get_text(separator=' ')
    price = regex_extract_price(text)
    availability = regex_extract_availability(text)
    if price is not None or availability:
        name = soup.h1.get_text(strip=True) if soup.h1 else (meta["name"] or soup.title.string)
        images = meta["images"] or []
        return {
            "name": name,
            "description": None,
            "images": images,
            "price": price,
            "availability": availability,
        }

    # 5) Trafilatura fallback
    downloaded = fetch_url(url)
    desc_text = traf_extract(downloaded, include_images=True) or ""
    imgs = [img.get("src") for img in soup.find_all("img") if img.get("src", "").startswith("http")]
    return {
        "name": meta["name"] or soup.title.string,
        "description": desc_text,
        "images": imgs,
        "price": None,
        "availability": None,
    }
def debug_list_ldjson(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    all_items = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            if isinstance(data, dict) and '@graph' in data:
                items = data['@graph']
            elif isinstance(data, list):
                items = data
            else:
                items = [data]
            for item in items:
                all_items.append(item)
        except Exception:
            continue
    # اعرض كل الكائنات والمفاتيح
    for i, obj in enumerate(all_items):
        print(f"\n[LD-JSON #{i}] keys = {list(obj.keys())}")
        # لو أحببت، اطبع كامل الكائن:
        # print(json.dumps(obj, indent=2, ensure_ascii=False))
def debug_list_itemprops(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    props = {}
    for tag in soup.find_all(attrs={"itemprop": True}):
        name = tag['itemprop']
        props.setdefault(name, []).append(tag.get_text(strip=True) or tag.get('content'))
    print("\n[itemprop values]")
    for prop, values in props.items():
        print(f" - {prop}: {values[:3]}{'…' if len(values)>3 else ''}")
def debug_list_meta(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    metas = {}
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        if key:
            metas[key] = tag.get("content")
    print("\n[meta tags]")
    for k,v in metas.items():
        print(f" - {k}: {v}")
