// src/vector/vector.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest'; // أو '@qdrant/qdrant-js'
import OpenAI from 'openai';
import { EmbeddableOffer, EmbeddableProduct } from './types';

@Injectable()
export class VectorService implements OnModuleInit {
  private qdrant: QdrantClient;
  private openai: OpenAI;
  private collection = 'products';
  private offerCollection = 'offers';

  private buildTextForEmbedding(product: {
    name: string;
    description: string;
    category?: string;
    specsBlock?: string[];
    keywords?: string[];
  }): string {
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
  private buildTextForOffer(o: EmbeddableOffer): string {
    const parts = [`Name: ${o.name}`, `Type: ${o.type}`];
    if (o.description) parts.push(`Description: ${o.description}`);
    if (o.code) parts.push(`Code: ${o.code}`);
    return parts.join('. ');
  }
  onModuleInit() {
    // تهيئة عميل Qdrant
    this.qdrant = new QdrantClient({ url: 'http://localhost:6333' });

    // تهيئة عميل OpenAI بالمفتاح من البيئة
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.ensureCollection();
  }

  private async ensureCollection() {
    // منتجات
    const exists = await this.qdrant.getCollections();
    if (!exists.collections.find((c) => c.name === this.collection)) {
      await this.qdrant.createCollection(this.collection, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
    }
    // عروض
    if (!exists.collections.find((c) => c.name === this.offerCollection)) {
      await this.qdrant.createCollection(this.offerCollection, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
    }
  }
  /** يحوّل نصّاً إلى embedding */
  async embed(text: string): Promise<number[]> {
    const resp = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    // resp.data قائمة من العناصر؛ نأخذ العنصر الأول
    return resp.data[0].embedding;
  }
  async upsertOffers(offers: EmbeddableOffer[]) {
    const points = await Promise.all(
      offers.map(async (o) => ({
        id: o.id,
        vector: await this.embed(this.buildTextForOffer(o)),
        payload: { id: o.id },
      })),
    );
    await this.qdrant.upsert(this.offerCollection, {
      wait: true,
      points,
    });
  }

  /** يبحث دلالياً عن عروض مشابهة بناءً على نص استعلام */
  async querySimilarOffers(text: string, topK = 5) {
    const vector = await this.embed(text);
    const result = await this.qdrant.search(this.offerCollection, {
      vector,
      limit: topK,
    });
    return result.map((r) => ({ id: r.id as string, score: r.score }));
  }
  /** يأخذ قائمة منتجات ويخزنها في Qdrant */
  async upsertProducts(products: EmbeddableProduct[]) {
    const points = await Promise.all(
      products.map(async (p) => {
        const text = this.buildTextForEmbedding(p);
        const vector = await this.embed(text);
        return {
          id: p.id,
          vector,
          payload: { id: p.id },
        };
      }),
    );

    await this.qdrant.upsert(this.collection, {
      wait: true,
      points,
    });
  }

  /** يبحث دلالياً عن منتجات مشابهة */
  async querySimilarProducts(text: string, topK = 5) {
    const vector = await this.embed(text);
    const result = await this.qdrant.search(this.collection, {
      vector,
      limit: topK,
      // معطيات اختيارية أخرى مثل filter أو with_payload
    });
    return result.map((r) => ({ id: r.id, score: r.score }));
  }
}
