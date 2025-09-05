# مخططات قاعدة البيانات - مشروع Musad Bot N8N

## نظرة عامة

هذا المستند يحتوي على مخططات ERD مفصلة لقاعدة البيانات المستخدمة في مشروع Musad Bot N8N. قاعدة البيانات تستخدم MongoDB مع Mongoose ODM.

## الجداول الرئيسية

### 1. جدول المستخدمين (Users)

```mermaid
erDiagram
    User {
        ObjectId _id PK
        string email UK "فريد، مطلوب"
        string password "مطلوب، مخفي"
        boolean firstLogin "افتراضي: true"
        string name "مطلوب"
        string phone "اختياري"
        enum role "MEMBER, ADMIN - افتراضي: MEMBER"
        boolean emailVerified "افتراضي: false"
        string emailVerificationCode "اختياري"
        Date emailVerificationExpiresAt "اختياري"
        ObjectId merchantId FK "مرجع لـ Merchant"
        Date passwordChangedAt "اختياري"
        object notificationsPrefs "تفضيلات الإشعارات"
        boolean active "افتراضي: true، مفهرس"
        Date deletedAt "للحذف الناعم"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 2. جدول التجار (Merchants)

```mermaid
erDiagram
    Merchant {
        ObjectId _id PK
        string name "اختياري"
        ObjectId userId FK "مرجع لـ User، مطلوب"
        array skippedChecklistItems "افتراضي: []"
        string logoUrl "اختياري"
        enum productSource "internal, salla, zid - افتراضي: internal"
        object productSourceConfig "إعدادات مصادر المنتجات"
        array addresses "عنوان التاجر"
        object socialLinks "روابط التواصل الاجتماعي"
        object subscription "خطة الاشتراك، مطلوب"
        array categories "فئات المنتجات"
        string customCategory "فئة مخصصة"
        string businessType "نوع النشاط"
        string businessDescription "وصف النشاط"
        string workflowId "معرف سير العمل"
        string publicSlug UK "فريد، مفهرس"
        string logoKey "مفتاح الشعار"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 3. جدول المنتجات (Products)

```mermaid
erDiagram
    Product {
        ObjectId _id PK
        ObjectId merchantId FK "مرجع لـ Merchant، مطلوب"
        string originalUrl "اختياري"
        string platform "افتراضي: ''"
        string name "مطلوب"
        string description "افتراضي: ''"
        number price "افتراضي: 0"
        boolean isAvailable "افتراضي: true"
        array images "افتراضي: []"
        ObjectId category FK "مرجع لـ Category"
        string lowQuantity "افتراضي: ''"
        array specsBlock "افتراضي: []"
        Date lastFetchedAt "اختياري"
        Date lastFullScrapedAt "اختياري"
        string errorState "اختياري"
        enum source "manual, api - مطلوب"
        string sourceUrl "اختياري"
        string externalId "اختياري"
        enum status "active, inactive, out_of_stock - افتراضي: active"
        Date lastSync "اختياري"
        enum syncStatus "ok, error, pending - اختياري"
        array offers "مراجع لـ Offer"
        array keywords "افتراضي: []"
        string uniqueKey UK "فريد، نادر"
        enum currency "SAR, USD, etc - افتراضي: SAR"
        object attributes "خصائص إضافية"
        object offer "تفاصيل العرض"
        string publicUrlStored "اختياري"
        string slug "اختياري"
        string storefrontSlug "اختياري"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 4. جدول الفئات (Categories)

```mermaid
erDiagram
    Category {
        ObjectId _id PK
        string name "مطلوب"
        ObjectId merchantId FK "مرجع لـ Merchant، مطلوب، مفهرس"
        ObjectId parent FK "مرجع لـ Category، اختياري، مفهرس"
        string description "افتراضي: ''"
        string image "افتراضي: ''"
        array keywords "افتراضي: []"
        string slug "مطلوب، فريد بين الإخوة"
        string path "افتراضي: ''"
        array ancestors "مراجع لـ Category، افتراضي: []"
        number depth "افتراضي: 0"
        number order "افتراضي: 0"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 5. جدول الطلبات (Orders)

```mermaid
erDiagram
    Order {
        ObjectId _id PK
        string merchantId "مطلوب"
        string sessionId "مطلوب"
        object customer "بيانات العميل، مطلوب"
        array products "منتجات الطلب، مطلوب"
        enum status "pending, paid, canceled, shipped, delivered, refunded - افتراضي: pending"
        string externalId "اختياري"
        enum source "manual, api, imported, mini-store, widget, storefront - افتراضي: storefront"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }

    OrderProduct {
        string productId "معرف المنتج"
        string name "اسم المنتج"
        number price "السعر"
        number quantity "الكمية"
        object metadata "بيانات إضافية"
    }
```

### 6. جدول الخطط (Plans)

```mermaid
erDiagram
    Plan {
        ObjectId _id PK
        string name UK "فريد، مطلوب، مفهرس"
        number priceCents "مطلوب، الحد الأدنى: 0"
        enum currency "USD, SAR, AED, YER - افتراضي: USD"
        number durationDays "مطلوب، الحد الأدنى: 1"
        number messageLimit "افتراضي: 100، الحد الأدنى: 0"
        boolean llmEnabled "افتراضي: true"
        boolean isTrial "افتراضي: false، مفهرس"
        boolean isActive "افتراضي: true، مفهرس"
        string description "اختياري"
        array features "افتراضي: []"
        enum billingPeriod "monthly, annual - افتراضي: monthly"
        number trialPeriodDays "افتراضي: 0، الحد الأدنى: 0"
        boolean archived "افتراضي: false، مفهرس"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 7. جدول تذاكر الدعم (Support Tickets)

```mermaid
erDiagram
    SupportTicket {
        ObjectId _id PK
        string name "مطلوب"
        string email "مطلوب، صغير، مقطوع"
        string phone "اختياري"
        enum topic "موضوع التذكرة، مطلوب"
        string subject "مطلوب"
        string message "مطلوب"
        enum status "حالة التذكرة - افتراضي: open"
        string source "افتراضي: landing"
        string ip "اختياري"
        string userAgent "اختياري"
        array attachments "مرفقات التذكرة"
        string ticketNumber UK "فريد، مفهرس"
        ObjectId merchantId FK "مرجع لـ Merchant، مفهرس"
        ObjectId createdBy FK "مرجع لـ User، مفهرس"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }

    AttachmentMeta {
        string originalName "مطلوب"
        string filename "مطلوب"
        string mimeType "مطلوب"
        number size "مطلوب"
        string url "اختياري"
        enum storage "disk, minio - افتراضي: disk"
    }
```

### 8. جدول الأسئلة الشائعة (FAQs)

```mermaid
erDiagram
    Faq {
        ObjectId _id PK
        string merchantId "مطلوب"
        string question "مطلوب"
        string answer "مطلوب"
        enum status "pending, completed, failed, deleted - افتراضي: pending"
        string errorMessage "اختياري"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 9. جدول أسئلة البوت (Bot FAQs)

```mermaid
erDiagram
    BotFaq {
        ObjectId _id PK
        string question "مطلوب، مقطوع"
        string answer "مطلوب، مقطوع"
        enum status "active, deleted - افتراضي: active، مفهرس"
        enum source "manual, auto, imported - افتراضي: manual، مفهرس"
        array tags "افتراضي: []، مفهرس"
        enum locale "ar, en - افتراضي: ar، مفهرس"
        enum vectorStatus "pending, ok, failed - افتراضي: pending، مفهرس"
        string createdBy "معرف المستخدم، اختياري"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 10. جدول الرسائل (Message Sessions)

```mermaid
erDiagram
    MessageSession {
        ObjectId _id PK
        ObjectId merchantId FK "مرجع لـ Merchant، مطلوب"
        string sessionId "مطلوب"
        enum transport "api, qr - اختياري"
        enum channel "whatsapp, telegram, webchat - مطلوب"
        boolean handoverToAgent "افتراضي: false"
        array messages "رسائل الجلسة"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }

    SingleMessage {
        ObjectId _id PK "معرف فريد للرسالة"
        enum role "customer, bot, agent - مطلوب"
        string text "مطلوب"
        Date timestamp "مطلوب"
        object metadata "اختياري"
        array keywords "افتراضي: []"
        enum rating "1, 0, null - افتراضي: null"
        string feedback "افتراضي: null"
        ObjectId ratedBy FK "مرجع لـ User، افتراضي: null"
        Date ratedAt "افتراضي: null"
    }
```

### 11. جدول العملاء المحتملين (Leads)

```mermaid
erDiagram
    Lead {
        ObjectId _id PK
        string merchantId "مطلوب، مفهرس"
        string sessionId "مطلوب"
        object data "بيانات العميل، مطلوب"
        string source "اختياري"
        string phoneNormalized "مفهرس، نادر"
        string name "اختياري"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 12. جدول الوثائق (Documents)

```mermaid
erDiagram
    Document {
        ObjectId _id PK
        string merchantId "مطلوب"
        string filename "مطلوب"
        string fileType "مطلوب"
        string storageKey "مطلوب"
        enum status "pending, processing, completed, failed - افتراضي: pending"
        string errorMessage "اختياري"
        Date createdAt "تلقائي"
        Date updatedAt "تلقائي"
    }
```

### 13. مخطط خطة الاشتراك (Subscription Plan)

```mermaid
erDiagram
    SubscriptionPlan {
        enum tier "free, starter, business, enterprise - مطلوب"
        ObjectId planId FK "مرجع لـ Plan، اختياري"
        Date startDate "مطلوب"
        Date endDate "اختياري"
        array features "افتراضي: []"
    }
```

## العلاقات بين الجداول

### العلاقات الرئيسية:

1. **User ↔ Merchant**: علاقة واحد لواحد

   - `User.merchantId` → `Merchant._id`
   - `Merchant.userId` → `User._id`

2. **Merchant ↔ Product**: علاقة واحد لكثير

   - `Product.merchantId` → `Merchant._id`

3. **Merchant ↔ Category**: علاقة واحد لكثير

   - `Category.merchantId` → `Merchant._id`

4. **Category ↔ Category**: علاقة ذاتية (Parent-Child)

   - `Category.parent` → `Category._id`

5. **Product ↔ Category**: علاقة كثير لواحد

   - `Product.category` → `Category._id`

6. **Merchant ↔ Order**: علاقة واحد لكثير

   - `Order.merchantId` → `Merchant._id` (string reference)

7. **Merchant ↔ SupportTicket**: علاقة واحد لكثير

   - `SupportTicket.merchantId` → `Merchant._id`

8. **User ↔ SupportTicket**: علاقة واحد لكثير

   - `SupportTicket.createdBy` → `User._id`

9. **Merchant ↔ MessageSession**: علاقة واحد لكثير

   - `MessageSession.merchantId` → `Merchant._id`

10. **User ↔ SingleMessage**: علاقة واحد لكثير (للتصنيف)

    - `SingleMessage.ratedBy` → `User._id`

11. **Merchant ↔ Lead**: علاقة واحد لكثير

    - `Lead.merchantId` → `Merchant._id` (string reference)

12. **Merchant ↔ Faq**: علاقة واحد لكثير

    - `Faq.merchantId` → `Merchant._id` (string reference)

13. **Merchant ↔ Document**: علاقة واحد لكثير

    - `Document.merchantId` → `Merchant._id` (string reference)

14. **Plan ↔ SubscriptionPlan**: علاقة واحد لواحد
    - `SubscriptionPlan.planId` → `Plan._id`

## الفهارس (Indexes)

### فهارس مهمة:

1. **User**:

   - `email` (unique, index)
   - `active` (index)

2. **Merchant**:

   - `publicSlug` (unique, index)

3. **Category**:

   - `merchantId + parent + slug` (unique)
   - `merchantId + path`
   - `merchantId + ancestors`
   - `merchantId + depth`

4. **Product**:

   - `uniqueKey` (unique, sparse)

5. **SupportTicket**:

   - `ticketNumber` (unique, index)
   - `createdAt` (descending)
   - `email + createdAt` (descending)

6. **BotFaq**:

   - `status + updatedAt` (descending)

7. **Faq**:

   - `merchantId + status + createdAt` (descending)

8. **Lead**:

   - `merchantId + phoneNormalized`
   - `merchantId + sessionId`

9. **Plan**:
   - `isActive + priceCents`

## ملاحظات مهمة

### أنواع البيانات:

- **ObjectId**: معرف فريد في MongoDB
- **enum**: قيم محددة مسبقاً
- **array**: مصفوفة من العناصر
- **object**: كائن JSON
- **Date**: تاريخ ووقت
- **string/number/boolean**: أنواع البيانات الأساسية

### القيود:

- **UK**: فريد (Unique Key)
- **PK**: المفتاح الأساسي (Primary Key)
- **FK**: المفتاح الخارجي (Foreign Key)
- **مطلوب**: حقل إجباري
- **اختياري**: حقل اختياري
- **افتراضي**: قيمة افتراضية

### أنماط التصميم:

- **Soft Delete**: استخدام `deletedAt` للحذف الناعم
- **Timestamps**: `createdAt` و `updatedAt` تلقائياً
- **Audit Trail**: تتبع التغييرات والأنشطة
- **Nested Schemas**: استخدام مخططات فرعية للبيانات المعقدة

## قواعد البيانات الخارجية

### Qdrant (Vector Database):

- **Collection: products**: منتجات مع embeddings
- **Collection: offers**: عروض المنتجات
- **Collection: faqs**: أسئلة شائعة مع embeddings
- **Collection: documents**: وثائق مع embeddings
- **Collection: bot_faqs**: أسئلة البوت مع embeddings
- **Collection: web_knowledge**: معرفة الويب

### Redis:

- تخزين مؤقت للجلسات
- تخزين مؤقت للبيانات المؤقتة

### RabbitMQ:

- طوابير المعالجة
- رسائل النظام

---

_تم إنشاء هذا المستند بناءً على تحليل كود المشروع الحالي_
