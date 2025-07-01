FROM python:3.11-slim

WORKDIR /app

# تثبيت المتطلبات
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ الكود
COPY app/ .

# تعريف الأمر الافتراضي
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
