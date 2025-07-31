import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddableProduct } from './types';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { v5 as uuidv5 } from 'uuid';
import { ProductsService } from '../products/products.service';
const PRODUCT_NAMESPACE = 'd94a5f5a-2bfc-4c2d-9f10-1234567890ab';
const FAQ_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

@Injectable()
export class VectorService implements OnModuleInit {
  private qdrant: QdrantClient;
  private readonly collection = 'products';
  private readonly offerCollection = 'offers';
  public readonly faqCollection = 'faqs';
  private readonly webCollection = 'web_knowledge'; // 👈 مجموعات جديدة
  private readonly logger = new Logger(VectorService.name);

  constructor(
    private readonly http: HttpService,
    @Inject(forwardRef(() => ProductsService)) // ← أضف هذه السطر
    private readonly productsService: ProductsService,
    // 👈 وأيضًا هذا لو استخدمته
  ) {}
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

  public async embed(text: string): Promise<number[]> {
    const embeddingUrl = ' http://31.97.155.167:8000';
    const response = await firstValueFrom(
      this.http.post<{ embeddings: number[][] }>(`${embeddingUrl}/embed`, {
        texts: [text],
      }),
    );

    const embedding = response.data.embeddings[0];

    // ✅ تحقق من أن المتجه موجود ويحتوي على 384 عنصر
    if (!embedding || embedding.length !== 384) {
      throw new Error(`Invalid embedding: ${JSON.stringify(embedding)}`);
    }

    return embedding;
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

  public async upsertProducts(products: EmbeddableProduct[]) {
    const points = await Promise.all(
      products.map(async (p) => ({
        id: uuidv5(p.id, PRODUCT_NAMESPACE), // ← UUID ثابت لكل منتج
        vector: await this.embed(this.buildTextForEmbedding(p)), // ← تحويل المنتج إلى متجه
        payload: {
          mongoId: p.id,
          merchantId: p.merchantId,
          name: p.name,
          description: p.description,
          category: p.category,
          specsBlock: p.specsBlock ?? [],
          keywords: p.keywords ?? [],
        },
      })),
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
      url?: string;
      score: number;
    }[]
  > {
    const vector = await this.embed(text);

    const rawResults = await this.qdrant.search(this.collection, {
      vector,
      limit: topK * 2,
      with_payload: {
        include: ['mongoId', 'name', 'price', 'url'],
      },
      filter: {
        must: [{ key: 'merchantId', match: { value: merchantId } }],
      },
    });

    if (!rawResults.length) return [];

    const candidateTexts = rawResults.map((item) => {
      const p = item.payload as any;
      return `Name: ${p.name ?? ''}`;
    });

    const rerankResponse = await firstValueFrom(
      this.http.post<{
        results: { text: string; score: number }[];
      }>('http://musaidbot-reranker:8500/rerank', {
        query: text,
        candidates: candidateTexts,
      }),
    );

    const reranked = rerankResponse.data.results.map((res, index) => {
      const original = rawResults[index];
      const payload = original.payload as any;
      return {
        id: payload.mongoId as string,
        score: res.score,
      };
    });

    // إنشاء خريطة لربط ID مع Score
    const productIdScoreMap = new Map<string, number>();
    const productIds = reranked.slice(0, topK).map((r) => {
      productIdScoreMap.set(r.id, r.score);
      return r.id;
    });

    // جلب التفاصيل من Mongo
    const products = await this.productsService.getProductByIdList(
      productIds,
      merchantId,
    );

    // دمج score داخل المنتج
    return products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      price: p.price,
      url: (p as any).url, // إذا موجود
      score: productIdScoreMap.get(p._id.toString()) ?? 0,
    }));
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
    if (product.name) parts.push(`Name: ${product.name}`);
    if (product.description) parts.push(`Description: ${product.description}`);
    if (product.category) parts.push(`Category: ${product.category}`);
    if (product.specsBlock?.length)
      parts.push(`Specs: ${product.specsBlock.join(', ')}`);
    if (product.keywords?.length)
      parts.push(`Keywords: ${product.keywords.join(', ')}`);
    return parts.join('. ');
  }
}
