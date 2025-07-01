// src/vector/vector.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddableOffer, EmbeddableProduct } from './types';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { v5 as uuidv5 } from 'uuid';
import { ProductsService } from '../products/products.service';
import { OffersService } from '../offers/offers.service';
const PRODUCT_NAMESPACE = 'd94a5f5a-2bfc-4c2d-9f10-1234567890ab';
const OFFER_NAMESPACE = 'a5c1321e-bd1f-4ee0-9cd5-abcdef123456';

@Injectable()
export class VectorService implements OnModuleInit {
  private qdrant: QdrantClient;
  private readonly collection = 'products';
  private readonly offerCollection = 'offers';

  constructor(
    private readonly http: HttpService,
    private readonly productsService: ProductsService, // 👈 أضف هذا
    private readonly offersService: OffersService, // 👈 وأيضًا هذا لو استخدمته
  ) {}
  public async onModuleInit(): Promise<void> {
    this.qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
    console.log('[VectorService] Qdrant URL is', process.env.QDRANT_URL);
    await this.ensureCollections();
  }

  private async ensureCollections(): Promise<void> {
    const existing = await this.qdrant.getCollections();
    if (!existing.collections.find((c) => c.name === this.collection)) {
      await this.qdrant.createCollection(this.collection, {
        vectors: { size: 384, distance: 'Cosine' },
      });
    }
    if (!existing.collections.find((c) => c.name === this.offerCollection)) {
      await this.qdrant.createCollection(this.offerCollection, {
        vectors: { size: 384, distance: 'Cosine' },
      });
    }
  }

  public async embed(text: string): Promise<number[]> {
    const response = await firstValueFrom(
      this.http.post<{ embeddings: number[][] }>(
        'http://localhost:8000/embed',
        { texts: [text] },
      ),
    );
    return response.data.embeddings[0];
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
      }>('http://reranker:8500/rerank', {
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

  public async upsertOffers(offers: EmbeddableOffer[]) {
    const points = await Promise.all(
      offers.map(async (offer) => ({
        id: uuidv5(offer.id, OFFER_NAMESPACE),
        vector: await this.embed(this.buildTextForOffer(offer)),
        payload: {
          mongoId: offer.id,
          name: offer.name,
          description: offer.description,
          type: offer.type,
          code: offer.code,
        },
      })),
    );

    return this.qdrant.upsert(this.offerCollection, { wait: true, points });
  }

  public async querySimilarOffers(
    text: string,
    merchantId: string,
    topK = 5,
  ): Promise<
    {
      id: string;
      name?: string;
      type?: string;
      description?: string;
      code?: string;
      score: number;
    }[]
  > {
    const vector = await this.embed(text);

    const rawResults = await this.qdrant.search(this.offerCollection, {
      vector,
      limit: topK * 2,
      with_payload: {
        include: ['mongoId', 'name', 'type', 'description', 'code'],
      },
      filter: {
        must: [{ key: 'merchantId', match: { value: merchantId } }],
      },
    });

    if (!rawResults.length) return [];

    const candidateTexts = rawResults.map((item) => {
      const p = item.payload as any;
      return `Name: ${p.name ?? ''}. Type: ${p.type ?? ''}`;
    });

    const rerankResponse = await firstValueFrom(
      this.http.post<{
        results: { text: string; score: number }[];
      }>('http://reranker:8500/rerank', {
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

    const offerIdScoreMap = new Map<string, number>();
    const offerIds = reranked.slice(0, topK).map((r) => {
      offerIdScoreMap.set(r.id, r.score);
      return r.id;
    });

    const offers = await this.offersService.getOfferByIdList(
      offerIds,
      merchantId,
    );

    return offers.map((offer) => ({
      id: offer._id.toString(),
      name: offer.name,
      type: offer.type,
      description: offer.description,
      code: offer.code,
      score: offerIdScoreMap.get(offer._id.toString()) ?? 0,
    }));
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

  private buildTextForOffer(offer: EmbeddableOffer): string {
    const parts: string[] = [`Name: ${offer.name}`, `Type: ${offer.type}`];
    if (offer.description) parts.push(`Description: ${offer.description}`);
    if (offer.code) parts.push(`Code: ${offer.code}`);
    return parts.join('. ');
  }
}
