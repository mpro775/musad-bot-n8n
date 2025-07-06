# MusaidBot Backend

مشروع Back-end مبني بإطار [NestJS](https://nestjs.com) لتشغيل خدمة **MusaidBot**. يوفر النظام واجهات REST لإدارة التجار والمنتجات والعروض وسير العمل عبر n8n، كما يستخدم MongoDB للتخزين وRedis للصفوف وذاكرة التخزين المؤقت. يعتمد كذلك على MinIO لحفظ الملفات ويستطيع التكامل مع Qdrant للبحث الدلالي.

## المتطلبات

- Node.js 18 فأعلى
- MongoDB
- Redis
- MinIO (لتخزين الملفات)
- Qdrant (اختياري)
- Docker و docker-compose للتشغيل الكامل

## الإعداد والتشغيل

1. انسخ الملف `.env.example` إلى `.env` ثم عدّل القيم بما يلائم بيئتك، مثل:
   - `MONGODB_URI` مسار قاعدة البيانات
   - `JWT_SECRET` مفتاح توقيع الرموز
   - `REDIS_URL` أو `REDIS_HOST` و`REDIS_PORT`
   - متغيرات MinIO: `MINIO_ENDPOINT` و`MINIO_PORT` و`MINIO_ACCESS_KEY` و`MINIO_SECRET_KEY`
   - `FRONTEND_ORIGIN` للنطاق المسموح به
   - `N8N_OPENAI_WEBHOOK_URL` وغيرها مما هو موضح في الملف

2. ثبّت الاعتماديات:

```bash
npm install
```

3. شغّل التطبيق في وضع التطوير:

```bash
npm run start:dev
```

   أو بواسطة Docker Compose:

```bash
docker-compose up
```

## أمثلة لاستخدام الـ API

تسجيل مستخدم وتسجيل الدخول ثم جلب المنتجات:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ali","email":"ali@example.com","password":"secret"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ali@example.com","password":"secret"}'

curl -H 'Authorization: Bearer <token>' \
  http://localhost:3000/api/products
```

## أوامر الاختبارات

لتشغيل اختبارات Jest:

```bash
npm run test
```

ولعرض نسبة التغطية:

```bash
npm run test:cov
```

بعد تشغيل التطبيق يمكنك استعراض توثيق جميع المسارات من خلال Swagger على المسار `/api/docs`.
