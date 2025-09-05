import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  BotFaqSearchItem,
  DocumentData,
  EmbeddableProduct,
  FAQData,
  SearchResult,
  WebData,
} from './types';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { v5 as uuidv5 } from 'uuid';
import { ProductsService } from '../products/products.service';
import { geminiRerankTopN } from './geminiRerank';
import { ConfigService } from '@nestjs/config';
const PRODUCT_NAMESPACE = 'd94a5f5a-2bfc-4c2d-9f10-1234567890ab';
const FAQ_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const toStr = (x: any): string | null => {
  if (x == null) return null;
  if (typeof x === 'string') return x.trim() || null;
  if (typeof x === 'object') {
    const id = x._id ?? x.id ?? x.value ?? x.$oid;
    if (typeof id === 'string') return id;
    const data = x?.buffer?.data ?? x?.data;
    if (Array.isArray(data) && data.length === 12) {
      return Array.from(data)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    const maybe = x.toString?.();
    if (maybe && maybe !== '[object Object]') return String(maybe);
  }
  return String(x);
};

const toNum = (x: any): number | null => {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: 'ر.س',
  YER: '﷼',
  USD: '$',
};
const fmtPrice = (n?: number | null, cur?: string | null) =>
  n == null ? '' : `${n} ${CURRENCY_SYMBOLS[cur || ''] || cur || ''}`;

// الأساس لتكوين URL مطلق
const PUBLIC_WEB_BASE_URL = (
  process.env.PUBLIC_WEB_BASE_URL || 'https://app.kaleem-ai.com'
).replace(/\/+$/, '');

// يبني رابطًا كاملًا (https://domain/... أو https://app/store/:slug/product/:slug)
const buildAbsoluteUrl = (p: EmbeddableProduct): string | null => {
  if (p.url) return p.url; // لو محفوظ جاهز
  if (p.publicUrlStored) {
    // لو مخزّن عندك مسارًا نسبيًا (مثل /store/slug/product/slug) حوّله لمطلق
    if (/^https?:\/\//i.test(p.publicUrlStored)) return p.publicUrlStored;
    return `${PUBLIC_WEB_BASE_URL}${p.publicUrlStored.startsWith('/') ? '' : '/'}${p.publicUrlStored}`;
  }
  if (p.domain && p.slug)
    return `https://${p.domain}/product/${encodeURIComponent(p.slug)}`;
  if (p.storefrontSlug && p.slug)
    return `${PUBLIC_WEB_BASE_URL}/store/${encodeURIComponent(p.storefrontSlug)}/product/${encodeURIComponent(p.slug)}`;
  // fallback: id
  if (p.storefrontSlug && p.id)
    return `${PUBLIC_WEB_BASE_URL}/store/${encodeURIComponent(p.storefrontSlug)}/product/${encodeURIComponent(p.id)}`;
  return null;
};
const truncate = (s: string, max = 400) =>
  s && s.length > max ? s.slice(0, max) + '…' : s || '';

// ابني رابط تلقائيًا لو ما وصل url
const buildUrl = (p: any): string | null => {
  if (p.url) return p.url;
  if (p.publicUrlStored) return p.publicUrlStored; // موجود عندك مسبقًا
  const slug = p.slug;
  const sf = p.storefrontSlug;
  if (slug && sf)
    return `/store/${encodeURIComponent(sf)}/product/${encodeURIComponent(slug)}`;
  if (slug && p.domain)
    return `https://${p.domain}/product/${encodeURIComponent(slug)}`;
  return null;
};

@Injectable()
export class VectorService implements OnModuleInit {
  private qdrant: QdrantClient;
  private readonly collection = 'products';
  private readonly offerCollection = 'offers';
  public readonly faqCollection = 'faqs';
  private readonly documentCollection = 'documents';
  private readonly botFaqCollection = 'bot_faqs'; // 👈 كولكشن منفصل لقاعدة معرفة كليم
  private readonly embeddingBase: string;

  private readonly webCollection = 'web_knowledge'; // 👈 مجموعات جديدة
  private readonly logger = new Logger(VectorService.name);

  constructor(
    private readonly http: HttpService,
    @Inject(forwardRef(() => ProductsService)) // ← أضف هذه السطر
    private readonly productsService: ProductsService,
    private config: ConfigService,
    // 👈 وأيضًا هذا لو استخدمته
  ) {
    this.embeddingBase = (
      this.config.get<string>('EMBEDDING_BASE_URL') || ''
    ).replace(/\/+$/, '');
    if (!this.embeddingBase) {
      throw new Error('EMBEDDING_BASE_URL is required');
    }
  }
  public async onModuleInit(): Promise<void> {
    this.qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
    console.log('[VectorService] Qdrant URL is', process.env.QDRANT_URL);
    const collections = await this.qdrant.getCollections();
    this.logger.log(`Available collections: ${JSON.stringify(collections)}`);
    await this.ensureCollections();
  }

  private async ensureCollections(): Promise<void> {
    const existing = await this.qdrant.getCollections();
    const requiredCollections = [
      this.collection,
      this.offerCollection,
      this.faqCollection,
      this.webCollection,
      this.documentCollection,
      this.botFaqCollection, // 👈 إضافة كولكشن جديدة
    ];

    for (const coll of requiredCollections) {
      if (!existing.collections.find((c) => c.name === coll)) {
        await this.qdrant.createCollection(coll, {
          vectors: {
            size: 384,
            distance: 'Cosine',
          },
        });
      }
    }
  }
  public async upsertBotFaqs(points: any[]) {
    // تأكد من وجود الكولكشن
    const existing = await this.qdrant.getCollections();
    if (!existing.collections.find((c) => c.name === this.botFaqCollection)) {
      await this.qdrant.createCollection(this.botFaqCollection, {
        vectors: { size: 384, distance: 'Cosine' },
      });
    }
    return this.qdrant.upsert(this.botFaqCollection, { wait: true, points });
  }

  async deleteWebKnowledgeByFilter(filter: any) {
    // @qdrant/js-client-rest يدعم:
    // client.delete(collection, { filter })
    return this.qdrant.delete(this.webCollection, { filter });
  }

  async deleteFaqsByFilter(filter: any) {
    return this.qdrant.delete(this.faqCollection, { filter });
  }

  // حذف نقطة FAQ واحدة بواسطة faqId (Mongo) باستخدام generateFaqId
  async deleteFaqPointByFaqId(faqMongoId: string) {
    const id = this.generateFaqId(faqMongoId);
    return this.qdrant.delete(this.faqCollection, { points: [id] });
  }

  // vector.service.ts
  public async embed(text: string): Promise<number[]> {
    const embeddingUrl = this.embeddingBase; // تأكد من إزالة المسافة الأولى قبل http
    try {
      console.log('🔤 Embedding text length:', text.length);
      console.log('🌐 Sending to Embedding URL:', `${embeddingUrl}/embed`);
      console.log('📦 Payload:', { texts: [text] });

      const response = await firstValueFrom(
        this.http.post<{ embeddings: number[][] }>(`${embeddingUrl}/embed`, {
          texts: [text],
        }),
      );

      console.log('✅ Embedding response received:', response.data);

      const embedding = response.data.embeddings[0];

      // تحقق من أن المتجه موجود ويحتوي على 384 عنصر
      if (!embedding || embedding.length !== 384) {
        throw new Error(`Invalid embedding length: ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      console.error(
        '❌ Embedding error:',
        error.response?.data || error.message,
      );
      throw new Error(`Bad Request: ${error.response?.data || error.message}`);
    }
  }
  // في upsertWebKnowledge()
  public async upsertWebKnowledge(points: any[]) {
    try {
      this.logger.log(`Attempting to upsert ${points.length} points`, {
        samplePoint: points[0], // تسجيل عينة من البيانات المرسلة
      });

      // التحقق من صحة البيانات قبل الإرسال
      const validatedPoints = points.map((point) => ({
        id: point.id || uuidv5(point.payload.text, PRODUCT_NAMESPACE),
        vector: point.vector,
        payload: {
          ...point.payload,
          merchantId: point.payload.merchantId?.toString(),
          text: point.payload.text?.substring(0, 500),
        },
      }));

      // التقسيم إلى دفعات صغيرة إذا لزم الأمر
      const batchSize = 10;
      for (let i = 0; i < validatedPoints.length; i += batchSize) {
        const batch = validatedPoints.slice(i, i + batchSize);

        await this.qdrant.upsert(this.webCollection, {
          wait: true,
          points: batch,
        });

        this.logger.log(
          `Upserted batch ${i / batchSize + 1} of ${Math.ceil(validatedPoints.length / batchSize)}`,
        );
      }

      this.logger.log('Upsert completed successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Full upsert error details:', {
        error: {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
        },
        pointsCount: points.length,
        samplePoint: points[0],
      });
      throw error;
    }
  }
  async upsertDocumentChunks(
    chunks: { id: string; vector: number[]; payload: any }[],
  ): Promise<void> {
    if (!chunks.length) return;

    // نظف كل payload
    const points = chunks.map((chunk) => ({
      id: chunk.id || uuidv5(chunk.payload.text, PRODUCT_NAMESPACE),
      vector: chunk.vector.length === 384 ? chunk.vector : [],
      payload: {
        merchantId: String(chunk.payload.merchantId ?? ''),
        documentId: String(chunk.payload.documentId ?? ''),
        text: (chunk.payload.text ?? '').toString().slice(0, 2000), // قلل الحجم للتجربة
      },
    }));

    // لا ترفع إذا vector فاضي أو خاطئ
    const validPoints = points.filter(
      (p) => Array.isArray(p.vector) && p.vector.length === 384,
    );

    if (!validPoints.length) throw new Error('No valid points to upsert!');

    const batchSize = 2;
    for (let i = 0; i < validPoints.length; i += batchSize) {
      const batch = validPoints.slice(i, i + batchSize);
      await this.qdrant.upsert(this.documentCollection, {
        wait: true,
        points: batch,
      });
    }
  }
  async deleteBotFaqPoint(pointId: string) {
    // REST client:
    return this.qdrant.delete(this.botFaqCollection, { points: [pointId] });
  }
  public async upsertProducts(products: EmbeddableProduct[]) {
    const points = await Promise.all(
      products.map(async (p0) => {
        // تطبيع
        const p: EmbeddableProduct = { ...p0 };

        const mongoId = toStr(p.id)!;
        const merchantId = toStr(p.merchantId)!;

        const categoryId = toStr(p.categoryId ?? (p as any).category);
        const categoryName = p.categoryName ?? null;

        const price = toNum(p.price);
        const priceOld = toNum(p.priceOld);
        const priceNew = toNum(p.priceNew);
        const priceEff = toNum(p.priceEffective) ?? price;

        const discountPct =
          priceOld && priceNew && priceOld > 0
            ? Math.max(0, Math.round(((priceOld - priceNew) / priceOld) * 100))
            : null;

        const urlAbs = buildAbsoluteUrl({
          ...p,
          id: mongoId,
          merchantId,
          categoryId,
          price,
          priceOld,
          priceNew,
          priceEffective: priceEff,
          discountPct,
        });

        // المتجه
        const vectorText = this.buildTextForEmbedding({
          ...p,
          id: mongoId,
          merchantId,
          categoryId,
          categoryName,
          price,
          priceOld,
          priceNew,
          priceEffective: priceEff,
          discountPct,
          url: urlAbs, // لأجل سطر "الرابط:" في النص
        });
        const vector = await this.embed(vectorText);

        // الـ payload (علشان البوت يشكل الرد والزر بسهولة)
        const payload = {
          mongoId,
          merchantId,
          name: p.name,
          description: p.description ?? '',
          categoryId: categoryId ?? null,
          categoryName,
          specsBlock: p.specsBlock ?? [],
          keywords: p.keywords ?? [],
          url: urlAbs, // 👈 مطلق وجاهز للزر
          slug: p.slug ?? null,
          storefrontSlug: p.storefrontSlug ?? null,
          domain: p.domain ?? null,

          images: Array.isArray(p.images) ? p.images.slice(0, 6) : [], // أولى الصور
          primaryImage:
            Array.isArray(p.images) && p.images[0] ? p.images[0] : null,

          price,
          priceEffective: priceEff,
          currency: p.currency ?? null,

          hasOffer: !!p.hasActiveOffer,
          priceOld,
          priceNew,
          offerStart: p.offerStart ?? null,
          offerEnd: p.offerEnd ?? null,
          discountPct,

          isAvailable:
            typeof p.isAvailable === 'boolean' ? p.isAvailable : null,
          status: p.status ?? null,
          quantity: p.quantity ?? null,
        };

        return {
          id: uuidv5(mongoId, PRODUCT_NAMESPACE),
          vector,
          payload,
        };
      }),
    );

    return this.qdrant.upsert(this.collection, { wait: true, points });
  }

  public async querySimilarProducts(
    text: string,
    merchantId: string,
    topK = 5,
  ): Promise<
    {
      id: string;
      name?: string;
      price?: number;
      priceEffective?: number;
      currency?: string;
      url?: string;
      image?: string;
      categoryName?: string;
      hasOffer?: boolean;
      discountPct?: number | null;
      score: number;
    }[]
  > {
    // 1) Embed للاستعلام
    const vector = await this.embed(text);

    // 2) بحث في Qdrant
    const rawResults = await this.qdrant.search(this.collection, {
      vector,
      limit: topK * 4,
      with_payload: {
        include: [
          'mongoId',
          'name',
          'description',
          'url',
          'images',
          'primaryImage',
          'price',
          'priceEffective',
          'currency',
          'categoryName',
          'hasOffer',
          'discountPct',
        ],
      },
      filter: {
        must: [{ key: 'merchantId', match: { value: String(merchantId) } }],
      },
    });

    if (!rawResults.length) return [];

    // 3) نصوص المرشحين لإعادة الترتيب (اختياري)
    const candidates = rawResults.map((item) => {
      const p = item.payload as any;
      // نص بسيط يكفي لإعادة الترتيب
      return `اسم المنتج: ${p.name ?? ''}${p.price ? ` - السعر: ${p.price}` : ''}`;
    });

    // 4) إعادة ترتيب عبر Gemini (إن متاح). الدالة قد تعيد:
    //    - مصفوفة فهارس [2,0,1,...] أو
    //    - مصفوفة كائنات { index, score }
    let rerankedIdx: number[] | null = null;
    try {
      const geminiResult = await geminiRerankTopN({
        query: text,
        candidates,
        topN: topK,
      });

      if (Array.isArray(geminiResult) && geminiResult.length) {
        if (typeof geminiResult[0] === 'number') {
          rerankedIdx = geminiResult as number[];
        } else if (
          typeof geminiResult[0] === 'object' &&
          'index' in (geminiResult[0] as any)
        ) {
          rerankedIdx = (
            geminiResult as unknown as Array<{ index: number; score?: number }>
          )
            .map((r) => r.index)
            .slice(0, topK);
        }
      }
    } catch {
      // لو فشل إعادة الترتيب، نكمل بالترتيب الأصلي القادم من Qdrant
    }

    // 5) إبراز أفضل Top K
    const pick = (i: number) => {
      const item = rawResults[i];
      const p = item.payload as any;
      return {
        id: String(p.mongoId),
        name: p.name,
        price: typeof p.price === 'number' ? p.price : undefined,
        priceEffective:
          typeof p.priceEffective === 'number' ? p.priceEffective : undefined,
        currency: p.currency ?? undefined,
        url: p.url ?? undefined, // 👈 الزر
        image:
          p.primaryImage ?? (Array.isArray(p.images) ? p.images[0] : undefined),
        categoryName: p.categoryName ?? undefined,
        hasOffer: !!p.hasOffer,
        discountPct: p.discountPct ?? null,
        score: item.score ?? 0,
      };
    };

    if (rerankedIdx && rerankedIdx.length) {
      return rerankedIdx
        .filter((i) => i >= 0 && i < rawResults.length)
        .slice(0, topK)
        .map(pick);
    }

    // بدون إعادة ترتيب: خذ الأوائل حسب مسافة المتجه
    return rawResults.slice(0, topK).map((_, index) => pick(index));
  }

  public async upsertFaqs(points: any[]) {
    await this.ensureFaqCollection(); // تأكد من وجود الجمعية
    return this.qdrant.upsert(this.faqCollection, { wait: true, points });
  }
  public generateFaqId(faqId: string) {
    return uuidv5(faqId, FAQ_NAMESPACE);
  }

  public generateWebKnowledgeId(merchantId: string, url: string): string {
    if (!merchantId || !url) {
      throw new Error('merchantId or URL is missing');
    }

    // اختياري: تحقق أن merchantId UUID صالح
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        merchantId,
      );
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(merchantId);
    if (!isUUID && !isMongoId) {
      throw new Error('merchantId must be UUID or Mongo ObjectId');
    }

    return uuidv5(`${merchantId}-${url}`, NAMESPACE);
  }
  public async unifiedSemanticSearch(
    text: string,
    merchantId: string,
    topK = 5,
  ): Promise<SearchResult[]> {
    const vector = await this.embed(text);
    const allResults: SearchResult[] = [];
    const searchTargets: { name: string; type: 'faq' | 'document' | 'web' }[] =
      [
        { name: this.faqCollection, type: 'faq' },
        { name: this.documentCollection, type: 'document' },
        { name: this.webCollection, type: 'web' },
      ];

    // اجلب topK*2 من كل مصدر
    await Promise.all(
      searchTargets.map(async (target) => {
        try {
          const results = await this.qdrant.search(target.name, {
            vector,
            limit: topK * 2,
            with_payload: true,
            filter: {
              must: [{ key: 'merchantId', match: { value: merchantId } }],
            },
          });
          for (const item of results) {
            allResults.push({
              type: target.type,
              score: item.score,
              data: (item.payload ?? {}) as FAQData | DocumentData | WebData,
              id: item.id,
            });
          }
        } catch (err) {
          this.logger.warn(
            `[unifiedSemanticSearch] Search failed for ${target.name}: ${err.message}`,
          );
        }
      }),
    );

    if (allResults.length === 0) return [];

    // حضّر المرشحين
    const candidates = allResults.map((r) => {
      if (r.type === 'faq')
        return `${r.data.question ?? ''} - ${r.data.answer ?? ''}`;
      if (r.type === 'web' || r.type === 'document')
        return `${r.data.text ?? ''}`;
      return '';
    });

    // أرسل النتائج إلى Gemini Rerank فقط
    const geminiResult = await geminiRerankTopN({
      query: text,
      candidates,
      topN: topK,
    });

    if (geminiResult.length > 0) {
      return geminiResult.slice(0, topK).map((idx) => allResults[idx]);
    }
    return [];
  }
  public async searchBotFaqs(
    text: string,
    topK = 5,
  ): Promise<BotFaqSearchItem[]> {
    const vector = await this.embed(text);

    const results = await this.qdrant.search(this.botFaqCollection, {
      vector,
      limit: topK,
      with_payload: true,
    });

    return results.map((item) => ({
      id: String(item.id),
      question:
        typeof item.payload?.question === 'string' ? item.payload.question : '',
      answer:
        typeof item.payload?.answer === 'string' ? item.payload.answer : '',
      score: Number(item.score ?? 0),
    }));
  }

  private async ensureFaqCollection() {
    const existing = await this.qdrant.getCollections();
    if (!existing.collections.find((c) => c.name === this.faqCollection)) {
      await this.qdrant.createCollection(this.faqCollection, {
        vectors: { size: 384, distance: 'Cosine' }, // ✅ التأكد من 384
      });
    }
  }
  private buildTextForEmbedding(product: EmbeddableProduct): string {
    const parts: string[] = [];

    // الأساس
    if (product.name) parts.push(`الاسم: ${product.name}`);
    if (product.description)
      parts.push(`الوصف: ${truncate(product.description, 500)}`);

    // الفئة
    const cat = product.categoryName || product.categoryId;
    if (cat) parts.push(`الفئة: ${cat}`);

    // المواصفات/الكلمات
    if (product.specsBlock?.length)
      parts.push(`المواصفات: ${product.specsBlock.join('، ')}`);
    if (product.attributes && Object.keys(product.attributes).length) {
      const attrs = Object.entries(product.attributes).map(
        ([k, v]) => `${k}: ${(v || []).join('/')}`,
      );
      parts.push(`السمات: ${attrs.join('؛ ')}`);
    }
    if (product.keywords?.length)
      parts.push(`كلمات مفتاحية: ${product.keywords.join('، ')}`);

    // التسعير والعروض
    const priceEff = product.priceEffective ?? product.price ?? null;
    const priceStr = fmtPrice(priceEff, product.currency);
    if (priceStr) parts.push(`السعر: ${priceStr}`);

    if (
      product.hasActiveOffer &&
      product.priceOld != null &&
      product.priceNew != null
    ) {
      const oldS = fmtPrice(product.priceOld, product.currency);
      const newS = fmtPrice(product.priceNew, product.currency);
      const pct = product.discountPct != null ? `${product.discountPct}%` : '';
      parts.push(`عرض: من ${oldS} إلى ${newS}${pct ? ` (خصم ${pct})` : ''}`);
      if (product.offerStart || product.offerEnd) {
        parts.push(
          `مدة العرض: ${product.offerStart ?? ''}${product.offerEnd ? ` حتى ${product.offerEnd}` : ''}`,
        );
      }
    }

    // الحالة
    if (product.status) parts.push(`الحالة: ${product.status}`);
    if (typeof product.isAvailable === 'boolean') {
      parts.push(`التوفر: ${product.isAvailable ? 'متوفر' : 'غير متوفر'}`);
    }
    if (product.quantity != null) parts.push(`الكمية: ${product.quantity}`);

    // أخيرًا الرابط (مفيد للبوت — وأيضًا نضعه في payload)
    const abs = buildAbsoluteUrl(product);
    if (abs) parts.push(`الرابط: ${abs}`);

    return parts.join('. ');
  }
}
