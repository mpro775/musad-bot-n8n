# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# أدوات أساسية + curl للصحة (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl dumb-init ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# المتطلبات
COPY app/requirements.txt .
RUN pip install -r requirements.txt

# تثبيت كروميوم مع تبعياته بنقرة واحدة
# (يغنيك عن قوائم مكتبات النظام الطويلة)
RUN python -m playwright install --with-deps chromium

# نسخ الكود
COPY app/ .

EXPOSE 8001
CMD ["dumb-init", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
