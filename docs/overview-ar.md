# توثيق مشروع MusaidBot

هذا المستودع يحتوي على تطبيق مبني بإطار **NestJS** لتنفيذ مهام المساعد الذكي وربطه بمنصة **n8n**. يقدم المشروع واجهات REST و WebSocket مع تكامل لعدة خدمات مثل قاعدة البيانات، التخزين السحابي، وذكاء اصطناعي عبر n8n.

## المتطلبات والتشغيل

بعد تثبيت الحزم عبر `npm install` يمكن تشغيل المشروع في وضع التطوير:

```bash
npm run start:dev
```

أو تنفيذ البناء ثم التشغيل للإنتاج:

```bash
npm run build
npm run start:prod
```

كما يوفر الملف `docker-compose.yml` جميع الخدمات الداعمة (MongoDB، Redis، MinIO، n8n وغيرها) ويمكن تشغيلها بواسطة:

```bash
docker compose up -d
```

## متغيرات البيئة

يحتوي الملف `.env.example` على أهم المتغيرات المطلوبة. من أبرزها إعدادات الاتصال بقاعدة البيانات وRedis وتخصيص n8n. مثال على ذلك الأسطر:

```env
MONGODB_URI="mongodb://admin:YourStrongPass@mongo:27017/musaidbot?authSource=admin"
JWT_SECRET="H8m3XE3WMo9AYTXW4gGjDfn86KpuLBkOepgYqaERZKxUVZCRrBkfapm6mJYHkTQL"
REDIS_URL="rediss://red-d1494k63jp1c73ff185g:MJN8NUTx5Dw1WioeZXzPhQ2leb8haBYJ@oregon-keyvalue.render.com:6379"
```

ويمكن ضبط مسار واجهة الويب للنظام عبر المتغير `FRONTEND_ORIGIN`.

## الخدمات في Docker Compose

يعرّف الملف `docker-compose.yml` مجموعة من الحاويات الضرورية للتشغيل. من بينها:

- خدمة **Redis** للحفظ المؤقت والمهام الدورية (الأسطر 4–18)
- خدمة **Qdrant** لمحرك البحث الدلالي (الأسطر 20–34)
- خدمة **MongoDB** مع لوحة تحكم `mongo-express` (الأسطر 36–73)
- خدمة **MinIO** للتخزين السحابي (الأسطر 87–105)
- الحاوية الرئيسية للتطبيق NestJS (الأسطر 107–128)
- حاوية **n8n** المسؤولة عن إدارة الـ workflows (الأسطر 143–170)

## بنية التطبيق

يعتمد التطبيق على هيكلة معيارية لوحدات NestJS. من أهم الوحدات:

- **AuthModule** للمصادقة وإصدار JWT
- **UsersModule** لإدارة المستخدمين
- **ProductsModule** لجلب المنتجات مع خدمة Scraper ودمج النتائج مع محرك Qdrant
- **MerchantsModule** والذي يحتوي على منطق بناء الـ prompt وربطه بكل تاجر
- **N8nWorkflowModule** لإنشاء وتحديث الـ workflows في n8n (انظر الملف `src/modules/n8n-workflow/n8n-workflow.service.ts`)
- **VectorModule** لتخزين المتجهات واستعلام البحث الدلالي عبر Qdrant
- **ScraperModule** المبني على Playwright لاستخلاص بيانات المنتجات دوريًا

كما يوفر التطبيق نقاط تواصل عبر WebSocket من خلال **ChatModule** وخدمات إرسال الرسائل في **MessagingModule**.

## قالب workflow في n8n

يحتوي المستودع على ملف `src/workflow-template.json` الذي يمثل نموذجًا لسيناريو متكامل يبدأ باستقبال رسالة Telegram ثم تمريرها إلى عقدة ذكاء اصطناعي ومن ثم إرسال الرد للعميل. يمكن استخدام هذا القالب كأساس لإنشاء Workflow لكل تاجر عبر خدمة `N8nWorkflowService`.

## ملخص

يوفر مشروع MusaidBot بنية متكاملة تجمع بين إمكانيات NestJS و n8n لتقديم مساعد ذكي قادر على التكامل مع خدمات خارجية (Telegram، OpenAI، قواعد البيانات). يمكن تخصيص الإعدادات والـ workflow لكل تاجر على حدة، مع دعم التخزين السحابي والتصفح الدلالي للمنتجات.
