from fastapi import FastAPI, Query
from extractor import full_extract

app = FastAPI(
    title="Product Extractor Service",
    description="Extract structured product data from any e-commerce page",
    version="1.0.0"
)

@app.get("/extract/", summary="Extract product data from URL")
async def extract_endpoint(
    url: str = Query(..., description="The full URL of the product page")
):
    """
    Returns JSON with fields:
    - name (string)
    - description (string)
    - images (list of URLs)
    - price (number|null)
    - availability (string|null)
    """
    result = full_extract(url)
    return {"data": result}
