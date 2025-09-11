// src/modules/products/services/product-index.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VectorService } from '../../vector/vector.service';
import { toEmbeddable } from '../utils/product.utils';

@Injectable()
export class ProductIndexService {
  private readonly logger = new Logger(ProductIndexService.name);
  constructor(private readonly vector: VectorService) {}

  async upsert(
    productDoc: any,
    storefront?: { slug?: string; domain?: string } | null,
    categoryName?: string | null,
  ) {
    try {
      const ep = toEmbeddable(productDoc, storefront, categoryName ?? null);
      await this.vector.upsertProducts([ep]);
    } catch (e) {
      this.logger.warn('vector upsert failed', e as any);
    }
  }
}
