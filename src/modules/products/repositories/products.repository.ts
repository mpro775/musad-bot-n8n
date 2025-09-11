// src/modules/products/repositories/products.repository.ts
import { Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { GetProductsDto } from '../dto/get-products.dto';
import { PaginationResult } from '../../../common/dto/pagination.dto';

export interface ProductsRepository {
  create(data: Partial<Product>): Promise<ProductDocument>;
  updateById(
    id: Types.ObjectId,
    set: Partial<Product>,
  ): Promise<ProductDocument | null>;
  findById(id: Types.ObjectId): Promise<ProductDocument | null>;
  deleteById(id: Types.ObjectId): Promise<boolean>;

  findByExternal(
    merchantId: Types.ObjectId,
    externalId: string,
  ): Promise<ProductDocument | null>;
  upsertExternal(
    merchantId: Types.ObjectId,
    provider: 'zid' | 'salla',
    data: Partial<Product> & { externalId: string },
  ): Promise<ProductDocument>;

  countByMerchant(merchantId: Types.ObjectId): Promise<number>;
  findAllByMerchant(merchantId: Types.ObjectId): Promise<any[]>; // يمكن تضييقها لاحقًا
  findPublicBySlug(storeSlug: string, productSlug: string): Promise<any | null>;

  list(
    merchantId: Types.ObjectId,
    dto: GetProductsDto,
  ): Promise<PaginationResult<any>>;
  listPublic(
    storeSlug: string,
    dto: GetProductsDto,
  ): Promise<PaginationResult<any>>;

  searchText(
    merchantId: Types.ObjectId,
    query: string,
    limit?: number,
  ): Promise<any[]>;
  searchHeuristics(
    merchantId: Types.ObjectId,
    query: string,
    limit?: number,
  ): Promise<any[]>;
  findByExternal(
    merchantId: Types.ObjectId,
    externalId: string,
  ): Promise<ProductDocument | null>;
  upsertExternal(
    merchantId: Types.ObjectId,
    provider: 'zid' | 'salla',
    data: Partial<Product> & { externalId: string },
  ): Promise<ProductDocument>;
  setAvailability(
    id: Types.ObjectId,
    isAvailable: boolean,
  ): Promise<any | null>;
  findByIdsScoped(ids: string[], merchantId: string): Promise<any[]>;
  removeByExternal(merchantId: string, externalId: string): Promise<void>;
}
