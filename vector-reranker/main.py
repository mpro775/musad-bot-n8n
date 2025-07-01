# vector-reranker/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

model_name = "BAAI/bge-reranker-large"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)
model.eval()

class RerankRequest(BaseModel):
    query: str
    candidates: List[str]

class RerankResponse(BaseModel):
    results: List[dict]

@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest):
    inputs = [f"{req.query} [SEP] {c}" for c in req.candidates]
    tokens = tokenizer(inputs, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        scores = model(**tokens).logits.squeeze().tolist()

    if isinstance(scores, float): scores = [scores]

    ranked = sorted(zip(req.candidates, scores), key=lambda x: x[1], reverse=True)
    return {"results": [{"text": t, "score": s} for t, s in ranked]}
