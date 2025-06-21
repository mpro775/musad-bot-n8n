// src/vector/vector.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddableOffer, EmbeddableProduct } from './types';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VectorService implements OnModuleInit {
  private qdrant: QdrantClient;
  private readonly collection = 'products';
  private readonly offerCollection = 'offers';

  constructor(private readonly http: HttpService) {}

  public async onModuleInit(): Promise<void> {
    this.qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
    console.log('[VectorService] Qdrant URL is', process.env.QDRANT_URL);
    await this.ensureCollections();
  }

  private async ensureCollections(): Promise<void> {
    const existing = await this.qdrant.getCollections();
    // Ensure products collection
    await this.recreateIfMismatch(existing.collections, this.collection);
    // Ensure offers collection
    await this.recreateIfMismatch(existing.collections, this.offerCollection);
  }

  private async recreateIfMismatch(
    collections: { name: string; vectors?: { size: number } }[],
    name: string,
  ): Promise<void> {
    const col = collections.find((c) => c.name === name);
    if (col) {
      const currentSize = col.vectors?.size;
      if (currentSize !== 384) {
        console.warn(
          `[VectorService] Deleting collection ${name} due to size mismatch: ${currentSize}`,
        );
        await this.qdrant.deleteCollection(name);
        await this.qdrant.createCollection(name, {
          vectors: { size: 384, distance: 'Cosine' },
        });
      }
    } else {
      await this.qdrant.createCollection(name, {
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
      products.map(async (product) => ({
        id: uuidv4(),
        vector: await this.embed(this.buildTextForEmbedding(product)),
        payload: { mongoId: product.id },
      })),
    );
    return this.qdrant.upsert(this.collection, { wait: true, points });
  }

  public async querySimilarProducts(
    text: string,
    topK = 5,
  ): Promise<{ id: string; score: number }[]> {
    const vector = await this.embed(text);
    const result = await this.qdrant.search(this.collection, {
      vector,
      limit: topK,
      with_payload: true,
    });
    return result.map((item) => ({
      id: item.payload?.mongoId as string,
      score: item.score,
    }));
  }

  public async upsertOffers(offers: EmbeddableOffer[]) {
    const points = await Promise.all(
      offers.map(async (offer) => ({
        id: uuidv4(),
        vector: await this.embed(this.buildTextForOffer(offer)),
        payload: { mongoId: offer.id },
      })),
    );
    return this.qdrant.upsert(this.offerCollection, { wait: true, points });
  }

  public async querySimilarOffers(
    text: string,
    topK = 5,
  ): Promise<{ id: string; score: number }[]> {
    const vector = await this.embed(text);
    const result = await this.qdrant.search(this.offerCollection, {
      vector,
      limit: topK,
      with_payload: true,
    });
    return result.map((item) => ({
      id: item.payload?.mongoId as string,
      score: item.score,
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
