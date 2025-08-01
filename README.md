# Musaid Bot Backend

هذا المشروع يحتوي على البنية الخلفية لـ **Musaid Bot** وهي منصة دردشة ومتابعة للتجار تعتمد على [NestJS](https://nestjs.com/) وتتكامل مع محرك الأتمتة [n8n](https://n8n.io/). يتضمن المشروع عدّة خدمات مساعدة مكتوبة بـ **FastAPI** لتوليد المتجهات (Embeddings)، وإعادة الترتيب (Vector Reranker)، واستخلاص معلومات المنتجات من صفحات الويب.

## المميزات

- واجهات REST و WebSocket لإدارة التجار، المنتجات، الطلبات، الفئات، العملاء المحتملين وغيرها.
- دمج مع قاعدة بيانات **MongoDB** و **Redis** لإدارة الجلسات والطوابير.
- تخزين الملفات باستخدام **MinIO**.
- بحث دلالي في المنتجات باستخدام **Qdrant** وخدمة توليد المتجهات.
- تشغيل مهام الأتمتة عبر **n8n**، مع إمكانية إنشاء وتعديل الـ Workflows من خلال الـ API.
- خدمات Python مساعدة:
  - `embedding-service` لتوليد المتجهات عبر مكتبة `sentence-transformers`.
  - `vector-reranker` لإعادة ترتيب النتائج باستخدام نموذج BGE.
  - `extractor-service` لاستخلاص تفاصيل المنتجات من الروابط.

## تشغيل المشروع محلياً

1. انسخ ملف المتغيرات:
   ```bash
   cp .env.example .env
   ```
   ثم عدّل القيم بما يناسب بيئتك (بيانات MongoDB، مفاتيح JWT، إعدادات Redis وMinIO ... إلخ).

2. شغّل الحزمة الكاملة عبر Docker Compose:
   ```bash
   docker-compose up --build
   ```
   سيقوم هذا الأمر بتشغيل الخدمات التالية:
   - قاعدة MongoDB وواجهة `mongo-express`.
   - خادوم Redis وواجهة `redis-commander`.
   - قاعدة Qdrant للبحث الدلالي.
   - خادم MinIO لتخزين الملفات.
   - خدمات Python (`embedding`, `reranker`, `extractor`).
   - تطبيق NestJS نفسه على المنفذ `3000`.
   - حاوية n8n على المنفذ `5678`.

3. لتشغيل الخادم فقط بدون Docker:
   ```bash
   npm install
   npm run start:dev
   ```

## الأوامر المفيدة

- بناء المشروع للإنتاج:
  ```bash
  npm run build
  ```
- تشغيل الاختبارات:
  ```bash
  npm run test
  npm run test:e2e
  npm run test:cov
  ```
- إنشاء مستخدم أدمن تجريبي (بعد ضبط المتغيرات في `.env`):
  ```bash
  npx ts-node scripts/seed-admin.ts
  ```

## هيكل المجلدات

- `src/` – الشيفرة المصدرية لتطبيق NestJS وبداخلها الوحدات (Modules) المختلفة مثل `merchants`, `products`, `chat`, `vector` ... إلخ.
- `embedding-service/` – خدمة FastAPI لتوليد Embeddings.
- `vector-reranker/` – خدمة FastAPI لإعادة ترتيب النتائج.
- `extractor-service/` – خدمة FastAPI لاستخراج بيانات المنتجات.
- `docker-compose.yml` – يعرّف الخدمات اللازمة لتشغيل النظام كاملاً محلياً.

## الرخصة

الشفرة في هذا المستودع مرخّصة تحت بند **UNLICENSED** كما هو مذكور في `package.json`، مما يعني أنها ليست برمجية مفتوحة المصدر بشكل كامل.

