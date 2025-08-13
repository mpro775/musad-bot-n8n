workspace "Kleem — Unified C4" "Context + Containers + Components + Deployment" {
  !identifiers hierarchical

  model {

    // === أشخاص وأنظمة خارجية (Context) ===
    person merchant "التاجر" "يدير متجره وإعداداته وصندوق وارد متجره."
    person shopper  "العميل" "يتحدث مع كليم ويشتري عبر القنوات."
    person platform_admin "الأدمن العام" "يشرف على كل التجار والمحادثات، يدرّب كليم عالميًا، ويتدخل يدويًا عند الحاجة."

    softwareSystem whatsapp      "WhatsApp Business API" "قناة خارجية"
    softwareSystem telegram      "Telegram Bot API"       "قناة خارجية"
    softwareSystem salla         "Salla"                  "منصة تجارة"
    softwareSystem zid           "Zid"                    "منصة تجارة"
    softwareSystem shopify       "Shopify"                "منصة تجارة"
    softwareSystem payment       "Payment Gateway"        "بوابة دفع"
    softwareSystem llm           "LLM Provider"           "خدمة نماذج"
    softwareSystem merchant_site "Merchant Website"       "موقع التاجر يستضيف ودجت الويب شات"

    // === نظام كليم وحاوياته (Containers) ===
    softwareSystem kleem "Kleem" "منصة محادثة ذكية للتجار + متجر مصغّر مدمج." {

      // Frontends
      container platform_admin_portal "Platform Admin Portal" "React/MUI" "لوحة الأدمن العام: إدارة المنصة/كل التجار، رؤية شاملة للمحادثات، تدريب عالمي."
      container merchant_portal        "Merchant Portal"        "React/MUI" "لوحة التاجر: إعدادات متجره، تقارير، صندوق وارد متجره، تدريب محدود."
      container web_chat               "Web Chat Widget"        "JS Widget" "ودجت الدردشة المضمّن بمواقع التجار."
      container storefront             "Micro Storefront"       "React/Next.js" "متجر مصغّر مرتبط بقنوات الدردشة (تصفح/عربة/دفع/متابعة طلبات)."

      // Backends & Infra
      container api     "Backend API"        "NestJS"  "Auth، Conversations/Inbox، Training/Feedback، Knowledge، Integrations، Webhooks"
      container workers "Background Workers" "NestJS"  "AMQP Consumers/Jobs"
      container n8n     "Orchestrator"       "n8n"     "سير عمل AI/Tools"
      container embed   "Embedding Service"  "FastAPI" "توليد Embeddings"
      container extractor "Extractor Service" "FastAPI/Playwright" "استخلاص صفحات/ملفات للفهرسة"
      container mongodb "MongoDB"            "Mongo"   "بيانات التطبيق/المحادثات/التقييمات"
      container redis   "Redis"              "Redis"   "Cache/Rate limits/Sessions"
      container qdrant  "Qdrant"             "Qdrant"  "بحث متجهي (منتجات/معرفة)"
      container rabbit  "RabbitMQ"           "AMQP"    "وسيط رسائل"
      container minio   "MinIO"              "S3-compatible" "ملفات (اختياري)"

      // علاقات الواجهات مع الـ API
      platform_admin_portal -> api "REST/JSON"
      merchant_portal       -> api "REST/JSON"
      web_chat              -> api "جلسات/رسائل" "REST/WebSocket"
      storefront            -> api "Browsing/Cart" "REST/JSON"

      // قرار الذكاء: إرسال إلى n8n عند الحاجة
      api -> n8n "Invoke AI workflow إذا كانت المحادثة غير موقوفة وتحتاج ردًا ذكيًا" "REST"

      // استخراج/فهرسة
      api       -> extractor "Trigger extraction" "HTTP"
      extractor -> rabbit    "ينشر مهام فهرسة/تنظيف" "AMQP"
      workers   -> qdrant    "Upsert vectors (indexing)" "HTTP"

      // قواعد البيانات والكاش والرسائل
      api     -> mongodb "CRUD" "Driver"
      api     -> redis   "Cache" "TCP"
      api     -> rabbit  "ينشر أحداث/مهام" "AMQP"
      workers -> rabbit  "يستهلك مهام" "AMQP"
      api     -> qdrant  "بحث" "HTTP"
      api     -> embed   "طلب Embedding" "HTTP"

      // أدوات من n8n إلى API
      n8n -> api "Tool-calls (searchProducts/knowledge)" "REST"

      // === مكوّنات الـ API (Components) ===
      container api {
        // -- Controllers --
        component "ChannelWebhookController" "Controller" "Webhook للقنوات (WhatsApp/Telegram) -> يسلم للمنطق"
        component "WebChatController" "Controller" "جلسات الويب شات / Streaming"
        component "ConversationsController" "Controller" "إدارة المحادثات/إيقاف البوت/تسلّم يدوي"
        component "TrainingController" "Controller" "تقييم الردود/تدريب/قائمة غير مُجاب"
        component "KnowledgeController" "Controller" "وثائق/FAQ/فهرسة"
        component "ProductsController" "Controller" "بحث/تفاصيل/فهرسة منتجات"
        component "StorefrontController" "Controller" "سلة/عناوين/طلبات"
        component "PaymentsController" "Controller" "بوابة الدفع"
        component "IntegrationsController" "Controller" "Salla/Zid/Shopify Auth/Sync"
        component "AdminController" "Controller" "إعدادات عامة/سياسات/تقارير"

        // -- Services / Domain --
        component "ConversationService" "Service" "حالة المحادثة/الرسائل/المالِكين"
        component "ConversationPolicyGuard" "Service" "قرار: paused? needs AI? route->n8n or human"
        component "HandoffService" "Service" "تسلّم بشري/إلغاء التسلّم/توجيه"
        component "AIOrchestratorClient" "Service" "النداء إلى n8n وتشغيل سير العمل"
        component "ToolRegistryService" "Service" "نقطة موحدة لاستدعاء الأدوات"
        component "KnowledgeService" "Service" "إدارة المعرفة + أوامر الفهرسة"
        component "ProductSearchService" "Service" "بحث منتجات (Hybrid)"
        component "VectorService" "Service" "عميل Qdrant (upsert/search)"
        component "EmbeddingClient" "Service" "عميل خدمة Embeddings"
        component "ExtractorClient" "Service" "استدعاء Extractor"
        component "FeedbackService" "Service" "تقييمات/تجميع غير مُجاب/تحفيز تدريب"
        component "InstructionService" "Service" "توليد توجيهات من ردود سيئة (Gemini)"
        component "RerankerService" "Service" "إعادة ترتيب النتائج (Gemini)"
        component "PaymentsService" "Service" "تكامل بوابة الدفع"
        component "IntegrationsService" "Service" "Salla/Zid/Shopify Sync"
        component "CacheService" "Service" "Redis Cache/Rate-limits"
        component "EventBus" "Service" "RabbitMQ Publisher"
        component "AuditLogger" "Service" "لوغّات/Tracing/Metrics"
        component "WebhookSignatureVerifier" "Service" "تحقق توقيع/أمن"
        component "IdempotencyStore" "Service" "منع تكرار الطلبات"

        // -- Repos --
        component "ConversationRepo" "Repository" "Mongo: conversations"
        component "MessageRepo"      "Repository" "Mongo: messages"
        component "UnansweredRepo"   "Repository" "Mongo: unanswered"
        component "InstructionRepo"  "Repository" "Mongo: instructions"
        component "MerchantRepo"     "Repository" "Mongo: merchants/settings"
        component "PolicyRepo"       "Repository" "Mongo: policies/flags"
        component "ProductRepo"      "Repository" "Mongo: products"
        component "KnowledgeRepo"    "Repository" "Mongo: knowledge docs"
        component "JobRepo"          "Repository" "Mongo: jobs/tasks"

        // -- Wiring (داخل API) --
        "ChannelWebhookController" -> "WebhookSignatureVerifier" "تحقق التوقيع"
        "ChannelWebhookController" -> "ConversationService" "تخزين/تحديث المحادثة والرسائل"
        "WebChatController"        -> "ConversationService"
        "ConversationsController"  -> "ConversationService"
        "ConversationsController"  -> "HandoffService"
        "ConversationsController"  -> "ConversationPolicyGuard"

        "TrainingController" -> "FeedbackService"
        "TrainingController" -> "InstructionService"
        "KnowledgeController" -> "KnowledgeService"
        "ProductsController"  -> "ProductSearchService"
        "StorefrontController"-> "PaymentsService"

        "ConversationPolicyGuard" -> "AIOrchestratorClient" "invoke if needs AI & not paused"
        "ConversationPolicyGuard" -> "HandoffService"       "route to human if paused/owned"

        "AIOrchestratorClient" -> "ToolRegistryService" "عند الحاجة لأداة محلية"
        "ToolRegistryService"  -> "ProductSearchService"
        "ToolRegistryService"  -> "KnowledgeService"

        "ProductSearchService" -> "VectorService"
        "KnowledgeService"     -> "VectorService"
        "VectorService"        -> "EmbeddingClient" "عند upsert"
        "KnowledgeService"     -> "ExtractorClient" "استخلاص قبل الفهرسة"

        "FeedbackService"    -> "UnansweredRepo" "تخزين غير مُجاب"
        "InstructionService" -> "InstructionRepo" "حفظ التوجيهات"
        "InstructionService" -> "RerankerService" "اختياري: تحسين ترتيب الإجابات لاحقًا"

        "ConversationService"     -> "ConversationRepo"
        "ConversationService"     -> "MessageRepo"
        "ProductSearchService"    -> "ProductRepo"
        "KnowledgeService"        -> "KnowledgeRepo"
        "ConversationsController" -> "PolicyRepo" "قراءة flags (paused/owners)"

        "EventBus"        -> "JobRepo" "سجل المهام (اختياري)"
        "ConversationService" -> "CacheService" "استفادة من الكاش"
        "AuditLogger"        -> "CacheService" "مقاييس/عدادات"

        // ربط مكوّنات API بحاويات خارجية
        "AIOrchestratorClient" -> n8n     "REST"
        "VectorService"        -> qdrant  "HTTP"
        "CacheService"         -> redis   "TCP"
        "ConversationRepo"     -> mongodb "Driver"
        "MessageRepo"          -> mongodb "Driver"
        "UnansweredRepo"       -> mongodb "Driver"
        "InstructionRepo"      -> mongodb "Driver"
        "ProductRepo"          -> mongodb "Driver"
        "KnowledgeRepo"        -> mongodb "Driver"
        "EventBus"             -> rabbit  "AMQP"
        "ExtractorClient"      -> extractor "HTTP"
        "EmbeddingClient"      -> embed   "HTTP"
        "PaymentsService"      -> payment "REST"

        // قنوات (inbound)
        "ChannelWebhookController" -> whatsapp "Inbound Webhook"
        "ChannelWebhookController" -> telegram "Inbound Webhook"
      }

      // === مكوّنات n8n (Components داخل حاوية n8n) ===
      container n8n {
        component "AI Agent (Main)" "Workflow" "نقطة الدخول؛ يستقبل الرسالة/السياق/merchantId"
        component "Classifier/Router" "Workflow" "يقرر: هل نحتاج أداة/LLM/لا شيء؟"
        component "Tool: searchProducts"  "HTTP Node" "REST إلى API /products/search"
        component "Tool: searchKnowledge" "HTTP Node" "REST إلى API /knowledge/search"
        component "LLM Node" "HTTP/Provider" "استدعاء LLM (prompt+context)"
        component "Reply Builder" "Workflow" "تجميع الرد النهائي"
        component "Quality Gate (AI check Responses)" "Workflow" "تصنيف جودة/غموض → aiAnalysis"
        component "Analytics Hook" "HTTP Node" "POST /api/analytics/webhook"

        // ربط داخلي n8n
        "AI Agent (Main)"    -> "Classifier/Router" "route()"
        "Classifier/Router"  -> "Tool: searchProducts"  "if product question"
        "Classifier/Router"  -> "Tool: searchKnowledge" "if policy/faq"
        "Classifier/Router"  -> "Reply Builder"         "if no tool needed"
        "Tool: searchProducts"  -> api "REST"
        "Tool: searchKnowledge" -> api "REST"
        "Reply Builder" -> "LLM Node" "compose"
        "LLM Node" -> llm "HTTPS"
        "Reply Builder" -> "Quality Gate (AI check Responses)" "validate"
        "Quality Gate (AI check Responses)" -> "Analytics Hook" "send aiAnalysis"
        "Quality Gate (AI check Responses)" -> api "POST /unanswered (عند الغموض)"
      }
    }

    // علاقات القنوات والتكاملات والمدفوعات (خارج كتلة kleem)
    merchant_site -> web_chat "استضافة ودجت الويب شات"
    whatsapp -> api "Inbound Webhook (messages/status)" "HTTPS"
    api      -> whatsapp "Send message / replies"       "HTTPS"
    telegram -> api "Inbound Webhook (updates)" "HTTPS"
    api      -> telegram "Send message"          "HTTPS"
    api -> salla   "Sync منتجات/طلبات" "REST"
    api -> zid     "Sync منتجات/طلبات" "REST"
    api -> shopify "Sync منتجات/طلبات" "REST"
    api -> payment "إنشاء مدفوعات/تحقق" "REST"
    n8n -> llm "Prompting/Completion" "HTTPS"
  }

  views {

    // === View: Context ===
    systemContext kleem {
      include *
      autoLayout lr
      title "Kleem — Context"
    }

    // === View: Containers ===
    container kleem {
      include *
      include whatsapp telegram salla zid shopify payment llm merchant_site
      autoLayout lr
      title "Kleem — Containers"
    }

    // === View: Backend Components (API) ===
    component api {
      include *
      autoLayout lr
      title "Kleem — Backend API Components"
    }

    // === View: n8n Components ===
    component n8n {
      include *
      autoLayout lr
      title "Kleem — n8n Components"
    }

    // === View: Deployment (docker-compose مختصر) ===
    deployment docker_compose {
      environment "docker-compose"
      autoLayout lr
      title "Kleem — Deployment (docker-compose)"
    }

    styles {
      element "Person" { background "#f59e0b"; color "#000" }
      element "Software System" { background "#10b981"; color "#000" }
      element "Container" { background "#0ea5e9"; color "#fff" }
      element "Component" { background "#14b8a6"; color "#000" }
      relationship { routing Orthogonal }
    }
  }

  // === Deployment model مطابق لملف docker-compose (اختصار عملي) ===
  model {
    deploymentEnvironment "docker-compose" {
      infrastructureNode host "Docker Host" "Linux VM" {
        infrastructureNode backnet "Bridge Network" "Docker network: backnet"

        containerInstance api_i       of kleem.api       { properties { "port" "3000" } }
        containerInstance workers_i   of kleem.workers   { }
        containerInstance n8n_i       of kleem.n8n       { properties { "port" "5678" } }
        containerInstance mongodb_i   of kleem.mongodb   { properties { "port" "27017" } }
        containerInstance redis_i     of kleem.redis     { properties { "port" "6379" } }
        containerInstance qdrant_i    of kleem.qdrant    { properties { "port" "6333" } }
        containerInstance embed_i     of kleem.embed     { properties { "port" "8000" } }
        containerInstance extractor_i of kleem.extractor { properties { "port" "8001" } }
        containerInstance minio_i     of kleem.minio     { properties { "ports" "9000,9001" } }
        containerInstance rabbit_i    of kleem.rabbit    { properties { "ports" "5672,15672,15692" } }

        // علاقات الشبكة الأساسية
        api_i       -> mongodb_i   "Driver"
        api_i       -> redis_i     "TCP"
        api_i       -> qdrant_i    "HTTP"
        api_i       -> embed_i     "HTTP"
        api_i       -> rabbit_i    "AMQP"
        api_i       -> minio_i     "S3 API"

        workers_i   -> rabbit_i    "AMQP (consume)"
        workers_i   -> qdrant_i    "HTTP (indexing)"
        workers_i   -> mongodb_i   "Driver"
        workers_i   -> minio_i     "S3 API"

        extractor_i -> rabbit_i    "AMQP (publish indexing)"
        extractor_i -> minio_i     "S3 API"

        n8n_i       -> api_i       "REST (tools)"
      }
    }
  }
}
