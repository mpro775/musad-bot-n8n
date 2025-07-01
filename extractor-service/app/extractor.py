import json
import requests
from fastapi import HTTPException
from bs4 import BeautifulSoup
from trafilatura import fetch_url, extract as traf_extract

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
                    return {
                        "name": item.get("name"),
                        "description": item.get("description"),
                        "images": item.get("image") if isinstance(item.get("image"), list) else [item.get("image")],
                        "price": float(price) if price else None,
                        "availability": availability,
                    }
        except json.JSONDecodeError:
            continue
    return None

def extract_meta(soup: BeautifulSoup):
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
    # 1. جلب HTML
    try:
        res = requests.get(url, timeout=30)
        res.raise_for_status()
        html = res.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fetch error: {e}")

    # 2. JSON-LD
    structured = extract_structured(html)
    if structured:
        return structured

    # 3. meta-tags
    soup = BeautifulSoup(html, "html.parser")
    meta = extract_meta(soup)
    if meta["name"] and meta["price"] is not None:
        return meta

    # 4. trafilatura لنص + استخراج images من DOM
    downloaded = fetch_url(url, timeout=30)
    text = traf_extract(downloaded, include_images=True) or ""
    images = [img.get("src") for img in soup.find_all("img") if img.get("src", "").startswith("http")]

    return {
        "name": soup.title.string if soup.title else None,
        "description": text,
        "images": images,
        "price": None,
        "availability": None,
    }
