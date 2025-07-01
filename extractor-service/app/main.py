# src/main.py
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from extractor import full_extract, fetch_html, debug_list_ldjson, debug_list_itemprops, debug_list_meta

app = FastAPI()

class ExtractResponse(BaseModel):
    name: str | None
    description: str | None
    images: list[str]
    price: float | None
    availability: str | None

class DataWrapper(BaseModel):
    data: ExtractResponse

@app.get(
    "/extract/",
    response_model=DataWrapper,
    responses={
        400: {"model": dict[str, str], "description": "Bad Request"},
        502: {"model": dict[str, str], "description": "Upstream fetch error"},
        504: {"model": dict[str, str], "description": "Timeout fetching page"},
        500: {"model": dict[str, str], "description": "Internal Server Error"},
    },
)
def extract_endpoint(url: str = Query(..., description="رابط صفحة المنتج")):
    try:
        result = full_extract(url)
        return {"data": result}
    except HTTPException as e:
        # HTTPException من داخل fetch_html أو full_extract
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})
    except Exception as e:
        # أي خطأ آخر
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get(
    "/debug/fields/",
    responses={
        200: {"model": dict[str, str]},
        400: {"model": dict[str, str]},
        502: {"model": dict[str, str]},
        504: {"model": dict[str, str]},
        500: {"model": dict[str, str]},
    },
)
def debug_fields(url: str = Query(..., description="رابط للتحليل")):
    try:
        html = fetch_html(url)
        debug_list_ldjson(html)
        debug_list_itemprops(html)
        debug_list_meta(html)
        return {"status": "see logs for LD-JSON, itemprop & meta tags"}
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
