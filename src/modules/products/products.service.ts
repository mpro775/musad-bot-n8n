// src/modules/products/products.service.ts (خلاصته بعد الفصل)
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductsRepository } from './repositories/products.repository';
import { ProductIndexService } from './services/product-index.service';
import { ProductMediaService } from './services/product-media.service';
import { CacheService } from '../../common/cache/cache.service';
import { GetProductsDto } from './dto/get-products.dto';
import { CreateProductDto, ProductSource } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StorefrontService } from '../storefront/storefront.service'; // افصل storefront repo/service
import { CategoriesService } from '../categories/categories.service';
import { ExternalProduct } from '../integrations/types';
import { Product } from './schemas/product.schema';
import { TranslationService } from '../../common/services/translation.service';
import { OutboxService } from '../../common/outbox/outbox.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject('ProductsRepository')
    private readonly repo: ProductsRepository,
    private readonly indexer: ProductIndexService,
    private readonly media: ProductMediaService,
    private readonly cache: CacheService,
    @Inject(forwardRef(() => StorefrontService))
    private readonly storefronts: StorefrontService,
    private readonly categories: CategoriesService,
    private readonly translationService: TranslationService,
    private readonly outbox: OutboxService,
  ) {}

  // مثال: إنشاء منتج
  async create(dto: CreateProductDto & { merchantId: string }) {
    const merchantId = new Types.ObjectId(dto.merchantId);
    const sf = await this.storefronts.findByMerchant(merchantId.toString());

    const data: Partial<Product> = {
      merchantId,
      storefrontSlug: sf?.slug,
      storefrontDomain: sf?.domain ?? undefined,
      originalUrl: dto.originalUrl,
      sourceUrl: dto.sourceUrl,
      externalId: dto.externalId,
      platform: dto.platform,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      currency: dto.currency,
      offer: dto.offer
        ? {
            ...dto.offer,
            startAt: dto.offer.startAt
              ? new Date(dto.offer.startAt)
              : undefined,
            endAt: dto.offer.endAt ? new Date(dto.offer.endAt) : undefined,
          }
        : undefined,
      isAvailable: dto.isAvailable,
      category: new Types.ObjectId(dto.category),
      specsBlock: dto.specsBlock,
      keywords: dto.keywords,
      images: dto.images,
      source: (dto.source ?? ProductSource.MANUAL) as 'manual' | 'api',
      status: 'active',
      syncStatus: dto.source === ProductSource.API ? 'pending' : 'ok',
    };

    let created!: Product;
    const session = await (this.repo as any).startSession?.();
    await session.withTransaction(async () => {
      created = await this.repo.create(data, session);
      await this.outbox.enqueueEvent(
        {
          aggregateType: 'product',
          aggregateId: created._id.toString(),
          eventType: 'product.created',
          exchange: 'products',
          routingKey: 'product.created',
          payload: {
            productId: created._id.toString(),
            merchantId: created.merchantId.toString(),
          },
          dedupeKey: `product.created:${created._id}`,
        },
        session,
      );
    });
    await session.endSession();

    // فهرسة مباشرة كـ fallback (حتى لو الـ Consumer غير مفعّل بعد)
    const catName = created.category
      ? await this.categories.findOne(
          created.category.toString(),
          merchantId.toString(),
        )
      : null;
    await this.indexer.upsert(created, sf, catName?.name ?? null);

    // كنس الكاش
    await this.cache.invalidate(`v1:products:list:${dto.merchantId}:*`);
    await this.cache.invalidate(`v1:products:popular:${dto.merchantId}:*`);

    return created;
  }

  async update(id: string, dto: UpdateProductDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(
        this.translationService.translate('validation.mongoId'),
      );
    const _id = new Types.ObjectId(id);

    let updated = await this.repo.updateById(_id, dto as any);
    if (!updated)
      throw new NotFoundException(
        this.translationService.translateProduct('errors.notFound'),
      );

    // أرسل حدث Outbox خارج Session هنا (أو غلّفه داخل Session إذا كانت تغييرات مترابطة)
    await this.outbox.enqueueEvent({
      aggregateType: 'product',
      aggregateId: updated._id.toString(),
      eventType: 'product.updated',
      exchange: 'products',
      routingKey: 'product.updated',
      payload: {
        productId: updated._id.toString(),
        merchantId: updated.merchantId.toString(),
      },
      dedupeKey: `product.updated:${updated._id}:${updated.updatedAt?.toISOString()}`,
    });

    const sf = await this.storefronts.findByMerchant(
      updated.merchantId.toString(),
    );
    const catName = updated.category
      ? await this.categories.findOne(
          updated.category.toString(),
          updated.merchantId.toString(),
        )
      : null;
    await this.indexer.upsert(updated, sf, catName?.name ?? null);

    return updated;
  }

  async uploadImages(
    productId: string,
    merchantId: string,
    files: Express.Multer.File[],
    replace = false,
  ) {
    const urls = await this.media.uploadMany(
      merchantId,
      productId,
      files,
      replace,
    );
    // حد 6 صور وتثبيت في DB عبر repo.updateById
    // ...
    return { urls };
  }

  // Upload product images to MinIO with detailed response
  async uploadProductImagesToMinio(
    productId: string,
    merchantId: string,
    files: Express.Multer.File[],
    options: { replace?: boolean } = {},
  ) {
    const { replace = false } = options;

    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException(
        this.translationService.translate('validation.mongoId'),
      );
    }

    const urls = await this.media.uploadMany(
      merchantId,
      productId,
      files,
      replace,
    );

    // Return detailed response as expected by controller
    return {
      urls,
      count: urls.length,
      accepted: urls.length,
      remaining: Math.max(0, 6 - urls.length), // Assuming max 6 images
    };
  }

  async setAvailability(productId: string, isAvailable: boolean) {
    if (!Types.ObjectId.isValid(productId))
      throw new BadRequestException(
        this.translationService.translate('validation.mongoId'),
      );
    return this.repo.setAvailability(
      new Types.ObjectId(productId),
      isAvailable,
    );
  }

  // Find single product by ID
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(
        this.translationService.translate('validation.mongoId'),
      );
    const product = await this.repo.findById(new Types.ObjectId(id));
    if (!product)
      throw new NotFoundException(
        this.translationService.translateProduct('errors.notFound'),
      );
    return product;
  }

  // Find all products by merchant ID
  async findAllByMerchant(merchantId: Types.ObjectId) {
    return this.repo.findAllByMerchant(merchantId);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(
        this.translationService.translate('validation.mongoId'),
      );
    const _id = new Types.ObjectId(id);

    // احصل على المنتج قبل الحذف لتحديث الفهرس والكاش
    const before = await this.repo.findById(_id);
    if (!before)
      throw new NotFoundException(
        this.translationService.translateProduct('errors.notFound'),
      );

    const session = await (this.repo as any).startSession?.();
    await session.withTransaction(async () => {
      const ok = await this.repo.deleteById(_id, session);
      if (!ok)
        throw new NotFoundException(
          this.translationService.translateProduct('errors.notFound'),
        );

      await this.outbox.enqueueEvent(
        {
          aggregateType: 'product',
          aggregateId: before._id.toString(),
          eventType: 'product.deleted',
          exchange: 'products',
          routingKey: 'product.deleted',
          payload: {
            productId: before._id.toString(),
            merchantId: before.merchantId.toString(),
          },
          dedupeKey: `product.deleted:${before._id}`,
        },
        session,
      );
    });
    await session.endSession();

    // حذف من المتجهات + كنس الكاش فورًا كـ fallback
    await this.indexer.removeOne(before._id.toString());
    await this.cache.invalidate(
      `v1:products:list:${before.merchantId.toString()}:*`,
    );
    await this.cache.invalidate(
      `v1:products:popular:${before.merchantId.toString()}:*`,
    );

    return {
      message: this.translationService.translateProduct('messages.deleted'),
    };
  }

  // بحث نصي بسيط داخل الكتالوج (غير المتجهي)
  async searchCatalog(merchantId: string, q: string) {
    const mId = new Types.ObjectId(merchantId);
    const prim = await this.repo.searchHeuristics(mId, q, 10);
    if (prim.length) return prim;
    try {
      const txt = await this.repo.searchText(mId, q, 10);
      if (txt.length) return txt;
    } catch {}
    return []; // أو fallback
  }

  // Search products with pagination
  async searchProducts(merchantId: string, query: string, dto: GetProductsDto) {
    const mId = new Types.ObjectId(merchantId);

    // First try heuristic search for exact matches
    const heuristicResults = await this.repo.searchHeuristics(
      mId,
      query,
      dto.limit || 20,
    );
    if (heuristicResults.length > 0) {
      return {
        items: heuristicResults,
        meta: {
          nextCursor: null,
          hasMore: false,
          count: heuristicResults.length,
        },
      };
    }

    // Fallback to text search with pagination
    try {
      const textResults = await this.repo.searchText(
        mId,
        query,
        dto.limit || 20,
      );
      return {
        items: textResults,
        meta: {
          nextCursor: null,
          hasMore: false,
          count: textResults.length,
        },
      };
    } catch (error) {
      // If text search fails, return empty results
      return {
        items: [],
        meta: {
          nextCursor: null,
          hasMore: false,
          count: 0,
        },
      };
    }
  }
  async upsertExternalProduct(
    merchantId: string,
    provider: 'zid' | 'salla',
    p: ExternalProduct,
  ): Promise<{ created: boolean; id: string }> {
    const mId = new Types.ObjectId(merchantId);

    // هل كان موجوداً قبل التحديث؟
    const existed = await this.repo.findByExternal(mId, p.externalId);

    // جهّز البيانات القياسية للـ upsert (بدون category mapping هنا)
    const docData: Partial<Product> & { externalId: string } = {
      merchantId: mId,
      source: ProductSource.API,
      externalId: p.externalId,
      platform: provider,

      name: p.title ?? '',
      description: (p.raw as any)?.description ?? '',
      price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
      isAvailable: (p.stock ?? 0) > 0,
      images: Array.isArray((p.raw as any)?.images)
        ? ((p.raw as any).images as Array<{ url?: string }>)
            .map((img) => img?.url)
            .filter((url): url is string => Boolean(url))
            .slice(0, 6)
        : [],

      // اترك category غير محددة إلى حين عمل mapping لاحقاً
      category: undefined,

      sourceUrl: (p.raw as any)?.permalink ?? null,
      originalUrl: (p.raw as any)?.permalink ?? null,

      keywords: [],
      status: 'active',
      syncStatus: 'ok',
    };

    // نفّذ الـ upsert عبر المستودع
    const doc = await this.repo.upsertExternal(mId, provider, docData);

    // فهرسة متجهات (مع معلومات الواجهة العامة)
    try {
      const sf = await this.storefronts.findByMerchant(
        doc.merchantId.toString(),
      );
      const catName = doc.category
        ? await this.categories.findOne(
            doc.category.toString(),
            doc.merchantId.toString(),
          )
        : null;
      await this.indexer.upsert(doc, sf, catName?.name ?? null);
    } catch (e) {
      // لا تكسر العملية لو فشلت الفهرسة
      this.logger.warn?.('vector upsert (external) failed', e as any);
    }

    return { created: !existed, id: doc._id.toString() };
  }

  // Get product by store slug and product slug (for public access)
  getPublicProducts = async (storeSlug: string, dto: GetProductsDto) => {
    const sf = await this.storefronts.findBySlug(storeSlug);
    if (!sf)
      return {
        items: [],
        meta: { hasMore: false, nextCursor: null, count: 0 },
      };
    return this.repo.listPublicByMerchant(
      new Types.ObjectId(sf.merchantId),
      dto,
    );
  };

  async getPublicBySlug(storeSlug: string, productSlug: string) {
    const sf = await this.storefronts.findBySlug(storeSlug);
    if (!sf) return null;
    return this.repo.findPublicBySlugWithMerchant(
      productSlug,
      new Types.ObjectId(sf.merchantId),
    );
  }
}
