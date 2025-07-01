FROM python:3.11-slim

WORKDIR /app

# 1) ثَبِّت المتطلبات الثنائية اللازمة لبناء lxml
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libxml2-dev \
      libxslt1-dev \
      python3-dev && \
    rm -rf /var/lib/apt/lists/*

# 2) انسخ requirements ثم ثبِّتها
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3) انسخ باقي الكود
COPY app/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
