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
    يجرب أولاً requests، ثم يتراجع إلى Playwright عند 403 أو خطأ آخر.
    """
    try:
        res = requests.get(url, timeout=30, headers=DEFAULT_HEADERS)
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
    يبحث في <script type="application/ld+json"> ويُرجع أول كائن Product إن وجد.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Product":
                    offers = item.get("offers", {})
                    price = offers.get("price") or offers.get("priceSpecification", {}).get("price")
                    availability = offers.get("availability")
                    images = item.get("image") or []
                    if isinstance(images, str):
                        images = [images]
                    return {
                        "name": item.get("name"),
                        "description": item.get("description"),
                        "images": images,
                        "price": float(price) if price else None,
                        "availability": availability,
                    }
        except json.JSONDecodeError:
            continue
    return None

def extract_meta(soup: BeautifulSoup):
    """
    استخلاص البيانات من Meta Tags (OG & Twitter & product:price)
    """
    def meta_content(prop):
        tag = soup.find("meta", {"property": prop})
        return tag.get("content") if tag else None

    name = meta_content("og:title") or meta_content("twitter:title")
    desc = meta_content("og:description") or meta_content("twitter:description")
    img  = meta_content("og:image") or meta_content("twitter:image")
    price_tag = soup.find("meta", {"property": "product:price:amount"})
    price = price_tag["content"] if price_tag and price_tag.get("content") else None

    return {
        "name": name,
        "description": desc,
        "images": [img] if img else [],
        "price": float(price) if price else None,
        "availability": None,
    }

def full_extract(url: str):
    """
    تنفّذ الاستخراج الكامل:
    1) جلب HTML (requests → Playwright)
    2) محاولة JSON-LD
    3) محاولة Meta Tags
    4) trafilatura للنص + استخراج الصور يدوياً
    """
    # 1. جلب HTML
    html = fetch_html(url)

    # 2. JSON-LD
    structured = extract_structured(html)
    if structured:
        return structured

    # 3. Meta Tags
    soup = BeautifulSoup(html, "html.parser")
    meta = extract_meta(soup)
    if meta["name"] and meta["price"] is not None:
        return meta

    # 4. trafilatura لاستخراج النص + استخراج الصور يدوياً من DOM
    downloaded = fetch_url(url)  # لا ندعم timeout أو headers هنا
    text = traf_extract(downloaded, include_images=True) or ""

    images = []
    for img_tag in soup.find_all("img"):
        src = img_tag.get("src", "")
        if src.startswith("http"):
            images.append(src)

    return {
        "name": soup.title.string if soup.title else None,
        "description": text,
        "images": images,
        "price": None,
        "availability": None,
    }
