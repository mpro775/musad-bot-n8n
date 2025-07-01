import requests
from fastapi import HTTPException
from extruct import extract
from w3lib.html import get_base_url
from bs4 import BeautifulSoup
from trafilatura import fetch_url, extract as traf_extract

def extract_structured(html: str, url: str):
    data = extract(html, base_url=get_base_url(html, url))
    for item in data.get("json-ld", []):
        if item.get("@type") == "Product":
            return {
                "name": item.get("name"),
                "description": item.get("description"),
                "images": item.get("image") or [],
                "price": float(item.get("offers", {}).get("price", 0)),
                "availability": item.get("offers", {}).get("availability"),
            }
    return None

def extract_meta(soup: BeautifulSoup):
    def meta_content(prop):
        tag = soup.find("meta", {"property": prop})
        return tag.get("content") if tag else None

    name = meta_content("og:title") or meta_content("twitter:title")
    desc = meta_content("og:description") or meta_content("twitter:description")
    img  = meta_content("og:image") or meta_content("twitter:image")
    price_tag = soup.find("meta", {"property": "product:price:amount"})
    price = float(price_tag["content"]) if price_tag and price_tag.get("content") else None

    return {
        "name": name,
        "description": desc,
        "images": [img] if img else [],
        "price": price,
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

    # 2. بيانات مهيكلة (JSON-LD, Microdata, RDFa)
    structured = extract_structured(html, url)
    if structured:
        return structured

    # 3. meta-tags (OG, Twitter)
    soup = BeautifulSoup(html, "html.parser")
    meta = extract_meta(soup)
    if meta["name"] and meta["price"] is not None:
        return meta

    # 4. trafilatura لاستخراج النص والصور
    downloaded = fetch_url(url, timeout=30)
    text = traf_extract(downloaded, include_images=True) or ""
    images = []
    for img_tag in soup.select("img"):
        src = img_tag.get("src")
        if src and src.startswith("http"):
            images.append(src)

    return {
        "name": soup.title.string if soup.title else None,
        "description": text,
        "images": images,
        "price": None,
        "availability": None,
    }
