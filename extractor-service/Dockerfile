FROM python:3.11-slim

WORKDIR /app

# 1) تثبيت المتطلبات الأساسية
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) تثبيت Playwright وبراوزر Chromium
RUN playwright install chromium

# 3) نسخ الكود
COPY app/ .

# 4) أمر التشغيل
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
