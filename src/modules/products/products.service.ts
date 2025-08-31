// src/modules/products/products.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductNotFoundError, OutOfStockError } from '../../common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, set, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { UpdateProductDto } from './dto/update-product.dto';

import { CreateProductDto, ProductSource } from './dto/create-product.dto';
import { VectorService } from '../vector/vector.service';
import { forwardRef, Inject } from '@nestjs/common';
import { ExternalProduct } from '../integrations/types';
import {
  Storefront,
  StorefrontDocument,
} from '../storefront/schemas/storefront.schema';
import { mapZidImageUrls } from './utils/map-image-urls';
import { ZidProductImage } from '../integrations/zid/zid.model';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import * as Minio from 'minio';
import { unlink } from 'fs/promises';
import sharp from 'sharp';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Inject(forwardRef(() => VectorService))
    private readonly vectorService: VectorService,
    @InjectModel(Storefront.name)
    private readonly storefrontModel: Model<StorefrontDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>, // 👈 جديد
    @Inject('MINIO_CLIENT') private readonly minio: Minio.Client,
  ) {}

  private normalizeSlug(input: string): string {
    let s = (input || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (s.length > 50) s = s.slice(0, 50).replace(/-+$/g, '');
    return s;
  }

  private baseStoreSlug(merchantId: Types.ObjectId) {
    return this.normalizeSlug(`store-${merchantId.toString().slice(-8)}`);
  }

  // 🔧 نسخة مرنة + تخلق افتراضي عند الحاجة
  private async getStorefrontInfo(
    merchantId: Types.ObjectId,
  ): Promise<{ slug: string; domain?: string }> {
    // ابحث بكل الطرق (في حال كان النوع String في DB لسبب قديم)
    const or = [
      { merchant: merchantId },
      { merchant: merchantId.toString() as any },
    ];

    let sf = await this.storefrontModel.findOne({ $or: or });
    if (!sf) {
      // لوج للتشخيص
      console.warn(
        '[getStorefrontInfo] storefront not found for merchant:',
        merchantId.toString(),
        '→ creating default',
      );

      // أنشئ واجهة متجر افتراضية و slug فريد
      let slug = this.baseStoreSlug(merchantId);
      let i = 1;
      while (await this.storefrontModel.exists({ slug })) {
        slug = this.normalizeSlug(`${this.baseStoreSlug(merchantId)}-${i++}`);
      }
      sf = await this.storefrontModel.create({
        merchant: merchantId,
        primaryColor: '#FF8500',
        secondaryColor: '#1976d2',
        buttonStyle: 'rounded',
        slug,
      });
    }

    // لو موجود لكن slug فاضي لأي سبب، ثبّته
    if (!sf.slug || !sf.slug.trim()) {
      let slug = this.baseStoreSlug(merchantId);
      let i = 1;
      while (
        await this.storefrontModel.exists({ slug, _id: { $ne: sf._id } })
      ) {
        slug = this.normalizeSlug(`${this.baseStoreSlug(merchantId)}-${i++}`);
      }
      sf.slug = slug;
      await sf.save();
    }

    // ارجاع البيانات
    return { slug: sf.slug, domain: sf.domain ?? undefined };
  }
  private genStoreSlugFallback(merchantId: Types.ObjectId) {
    return this.normalizeSlug(`store-${merchantId.toString().slice(-8)}`);
  }
  private isOfferActive(ofr?: {
    enabled?: boolean;
    startAt?: Date;
    endAt?: Date;
    newPrice?: number;
  }) {
    if (!ofr?.enabled || ofr.newPrice == null) return false;
    const now = new Date();
    const startOk = ofr.startAt ? now >= new Date(ofr.startAt) : true;
    const endOk = ofr.endAt ? now <= new Date(ofr.endAt) : true;
    return startOk && endOk;
  }

  private async ensureUniqueSlug(merchantId: Types.ObjectId, base: string) {
    // لو base فاضي استخدم fallback
    let s = base && base.trim() ? base : this.genStoreSlugFallback(merchantId);
    let i = 0;
    while (await this.productModel.exists({ merchantId, slug: s })) {
      i += 1;
      // في الحالات العربية نزيد لاحقة رقمية آمنة
      s = `${base && base.trim() ? base : this.genStoreSlugFallback(merchantId)}-${i}`;
    }
    return s;
  }

  // ====== Helpers للتخزين ======
  private async ensureBucket(bucket: string) {
    const exists = await this.minio.bucketExists(bucket).catch(() => false);
    if (!exists)
      await this.minio.makeBucket(
        bucket,
        process.env.MINIO_REGION || 'us-east-1',
      );
  }
  private async publicUrlFor(bucket: string, key: string): Promise<string> {
    const cdnBase = (process.env.ASSETS_CDN_BASE_URL || '').replace(/\/+$/, '');
    const minioPublic = (process.env.MINIO_PUBLIC_URL || '').replace(
      /\/+$/,
      '',
    );

    if (cdnBase) return `${cdnBase}/${bucket}/${key}`;
    if (minioPublic) return `${minioPublic}/${bucket}/${key}`;

    // كان لديك minio.presignedUrl(..., 7d) — غيّرناه لساعة وبـ presignedGetObject
    return await this.minio.presignedGetObject(bucket, key, 3600);
  }

  // ====== التحقق من الفئة Leaf ======
  private async assertLeafCategory(
    merchantId: Types.ObjectId,
    categoryId: string,
  ) {
    const cat = await this.categoryModel
      .findOne({ _id: categoryId, merchantId })
      .lean();
    if (!cat) throw new BadRequestException('الفئة غير موجودة لهذا التاجر');
    const hasChildren = await this.categoryModel.exists({
      merchantId,
      parent: cat._id,
    });
    if (hasChildren) {
      throw new BadRequestException(
        'لا يمكن إضافة منتجات لفئة لديها أبناء. اختر فئة فرعية نهائية.',
      );
    }
    return cat._id;
  }

  // ====== معالجة الصورة (مربع ≤2MB) ======
  private async processPreserveAspectUnder2MB(
    inputPath: string,
    maxMP = 5, // حد أقصى ~5 ميجا بكسل
  ): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    const MAX_PIXELS = Math.floor(maxMP * 1_000_000);
    const img = sharp(inputPath, { failOn: 'none' });
    const meta = await img.metadata();
    const w = meta.width ?? 0,
      h = meta.height ?? 0;
    if (w <= 0 || h <= 0)
      throw new BadRequestException('لا يمكن قراءة أبعاد الصورة');

    let pipeline = img;

    // لو عدد البكسلات كبير، صغّر مع الحفاظ على النسبة (بدون قصّ)
    const total = w * h;
    if (total > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / total);
      const newW = Math.max(1, Math.floor(w * scale));
      const newH = Math.max(1, Math.floor(h * scale));
      pipeline = pipeline.resize(newW, newH, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // جرّب WEBP بجودات متدرجة لتصل ≤ 2MB
    for (const q of [85, 80, 70, 60, 50]) {
      const buf = await pipeline.webp({ quality: q }).toBuffer();
      if (buf.length <= 2 * 1024 * 1024)
        return { buffer: buf, mime: 'image/webp', ext: 'webp' };
    }
    // محاولة أخيرة JPEG
    for (const q of [80, 70, 60, 50]) {
      const buf = await pipeline.jpeg({ quality: q }).toBuffer();
      if (buf.length <= 2 * 1024 * 1024)
        return { buffer: buf, mime: 'image/jpeg', ext: 'jpg' };
    }
    throw new BadRequestException('تعذر ضغط الصورة تحت 2MB؛ استخدم صورة أصغر.');
  }

  // ====== رفع صور المنتج المتعددة ======
  async uploadProductImagesToMinio(
    productId: string,
    merchantId: string,
    files: Express.Multer.File[],
    opts?: { replace?: boolean },
  ): Promise<{
    urls: string[];
    count: number;
    accepted: number;
    remaining: number;
  }> {
    const MAX_IMAGES = 6;

    const p = await this.productModel.findOne({
      _id: productId,
      merchantId: new Types.ObjectId(merchantId),
    });
    if (!p) throw new ProductNotFoundError(productId);

    const bucket = process.env.MINIO_BUCKET!;
    await this.ensureBucket(bucket);

    // احسب المتاح
    const current = opts?.replace ? 0 : (p.images?.length ?? 0);
    if (current >= MAX_IMAGES && !opts?.replace) {
      throw new BadRequestException(
        'لا يمكن إضافة المزيد من الصور: الحد الأقصى 6 صور.',
      );
    }
    const availableSlots = MAX_IMAGES - current;
    const filesToProcess = opts?.replace
      ? files.slice(0, MAX_IMAGES)
      : files.slice(0, availableSlots);

    const urls: string[] = [];
    let i = 0;
    for (const file of filesToProcess) {
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        try {
          await unlink(file.path);
        } catch {}
        throw new BadRequestException('صيغة الصورة غير مدعومة (PNG/JPG/WEBP)');
      }

      // حول للصيغة/الحجم المطلوبين
      const out = await this.processPreserveAspectUnder2MB(file.path); // { buffer, mime, ext }
      const key = `merchants/${merchantId}/products/${productId}/image-${Date.now()}-${i++}.${out.ext}`;

      try {
        // ارفع الـ buffer الناتج وليس الملف الأصلي
        await this.minio.putObject(bucket, key, out.buffer, out.buffer.length, {
          'Content-Type': out.mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
        });

        const url = await this.publicUrlFor(bucket, key);
        urls.push(url);
      } finally {
        try {
          await unlink(file.path);
        } catch {}
      }
    }

    if (opts?.replace) {
      p.images = urls;
    } else {
      p.images = [...(p.images || []), ...urls].slice(0, MAX_IMAGES);
    }
    await p.save();

    return {
      urls,
      count: p.images.length,
      accepted: filesToProcess.length,
      remaining: Math.max(0, MAX_IMAGES - p.images.length),
    };
  }
  private async generateUniqueSlug(
    merchantId: string | Types.ObjectId,
  ): Promise<string> {
    const MAX_TRIES = 6;
    for (let i = 0; i < MAX_TRIES; i++) {
      const slug = 'p-' + Math.random().toString(16).slice(2, 8);
      const exists = await this.productModel.exists({ merchantId, slug });
      if (!exists) return slug;
    }
    // fallback أطول
    return 'p-' + Date.now().toString(36);
  }

  private sanitizeAttributes(input?: Record<string, string[]>) {
    if (!input || typeof input !== 'object') return undefined;
    const out: Record<string, string[]> = {};
    for (const [k, arr] of Object.entries(input)) {
      const key = String(k || '').trim();
      if (!key) continue;
      const vals = Array.isArray(arr)
        ? arr.map((v) => String(v).trim()).filter(Boolean)
        : [];
      if (vals.length) out[key] = Array.from(new Set(vals)).slice(0, 50); // حد أقصى مع إزالة التكرار
    }
    return Object.keys(out).length ? out : undefined;
  }

  private isLeafCategory(categoryId: string, cats: any[]): boolean {
    const parentIds = new Set(
      cats.filter((c) => c.parent).map((c) => String(c.parent)),
    );
    return !parentIds.has(String(categoryId));
  }

  // src/modules/products/products.service.ts (المقتطفات الأهم)
  async create(
    dto: CreateProductDto & { merchantId: string },
  ): Promise<ProductDocument> {
    const merchantId = new Types.ObjectId(dto.merchantId);
    const { slug: storefrontSlug, domain: storefrontDomain } =
      await this.getStorefrontInfo(merchantId);

    const name = dto.name?.trim() || '';
    const base = dto.slug
      ? this.normalizeSlug(dto.slug)
      : this.normalizeSlug(name);
    const productSlug = await this.ensureUniqueSlug(merchantId, base);

    const uniqueKey =
      dto.source === ProductSource.API && dto.externalId
        ? `${dto.merchantId}|ext:${dto.externalId}`
        : `${dto.merchantId}|slug:${productSlug}`;

    const product = await this.productModel.create({
      merchantId,
      storefrontSlug, // ✅ صار string مؤكد
      storefrontDomain, // ✅ undefined بدل null
      slug: productSlug, // ✅ مضمون دائمًا
      originalUrl:
        dto.source === ProductSource.API
          ? (dto.originalUrl ?? dto.sourceUrl ?? null)
          : null,
      sourceUrl:
        dto.source === ProductSource.API
          ? (dto.sourceUrl ?? dto.originalUrl ?? null)
          : null,
      externalId:
        dto.source === ProductSource.API ? (dto.externalId ?? null) : null,
      platform: dto.platform || '',
      name,
      description: dto.description || '',
      price: dto.price || 0,
      currency: dto.currency ?? 'SAR',
      offer: dto.offer
        ? {
            enabled: !!dto.offer.enabled,
            oldPrice: dto.offer.oldPrice ?? undefined,
            newPrice: dto.offer.newPrice ?? undefined,
            startAt: dto.offer.startAt
              ? new Date(dto.offer.startAt)
              : undefined,
            endAt: dto.offer.endAt ? new Date(dto.offer.endAt) : undefined,
          }
        : undefined,
      isAvailable: dto.isAvailable ?? true,
      images: dto.images || [],
      category: dto.category ? new Types.ObjectId(dto.category) : undefined,
      lowQuantity: dto.lowQuantity || undefined,
      specsBlock: dto.specsBlock || [],
      attributes: this.sanitizeAttributes(dto.attributes),

      lastFetchedAt: null,
      lastFullScrapedAt: null,
      errorState: null,
      source: dto.source ?? ProductSource.MANUAL,
      status: 'active',
      lastSync: null,
      syncStatus: dto.source === ProductSource.API ? 'pending' : 'ok',
      offers: [],
      keywords: dto.keywords || [],
      uniqueKey,
    });

    await this.vectorService.upsertProducts([
      {
        id: product._id.toString(),
        merchantId: product.merchantId.toString(),
        name: product.name,
        description: product.description,
        category: product.category?.toString(),
        specsBlock: product.specsBlock,
        keywords: product.keywords,
        url: (product as any).publicUrl,
        price: product.price ?? 0,
      },
    ]);

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product id');
    }
    const _id = new Types.ObjectId(id);

    // قيّم مسموح تحديثها
    const allowed: (keyof UpdateProductDto)[] = [
      'name',
      'description',
      'price',
      'isAvailable',
      'currency',
      'keywords',
      'specsBlock',
      'images',
      'category',
      'offer',
      'attributes',
    ];

    const update: any = {};
    for (const k of allowed) {
      if ((dto as any)[k] !== undefined) update[k] = (dto as any)[k];
    }

    // category يجب أن تكون string (معرّف الفئة)
    if (update.category != null && typeof update.category !== 'string') {
      update.category = String(update.category);
    }

    // صور بحد أقصى 6 وبشرط أن تكون مصفوفة نصوص
    if (Array.isArray(update.images)) {
      update.images = update.images
        .filter((u: any) => typeof u === 'string')
        .slice(0, 6);
    }

    // العرض: إن لم يكن مفعلاً اجعله { enabled:false } فقط
    if (update.offer && update.offer.enabled !== true) {
      update.offer = { enabled: false };
    }

    // attributes يجب أن تكون Record<string,string[]>
    if (update.attributes && typeof update.attributes === 'object') {
      const norm: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(update.attributes)) {
        if (Array.isArray(v)) norm[k] = v.map((x) => String(x));
      }
      update.attributes = norm;
    }

    const doc = await this.productModel.findByIdAndUpdate(
      _id,
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!doc) throw new ProductNotFoundError(id);

    // (اختياري) تحدّث المتجهات لو يلزم
    try {
      await this.vectorService.upsertProducts([
        {
          id: doc._id.toString(),
          merchantId: doc.merchantId.toString?.() ?? String(doc.merchantId),
          name: doc.name,
          description: doc.description,
          category:
            typeof doc.category === 'object'
              ? doc.category.toString()
              : doc.category,
          specsBlock: doc.specsBlock,
          keywords: doc.keywords,
        },
      ]);
    } catch (e) {
      // لا تكسر الطلب بسبب المتجهات
    }

    return doc;
  }

  // مزامنة خارجي (زد/سلة)
  // src/modules/products/products.service.ts (مقتطف التكييف لـ Zid/Salla)
  async upsertExternalProduct(
    merchantId: string,
    provider: 'zid' | 'salla',
    p: ExternalProduct,
  ): Promise<{ created: boolean; id: string }> {
    const mId = new Types.ObjectId(merchantId);
    const sf = await this.storefrontModel.findOne({ merchant: mId }).lean();
    const storefrontSlug = sf?.slug || undefined;
    const storefrontDomain = sf?.domain || undefined;

    const filter = {
      merchantId: mId,
      source: ProductSource.API,
      externalId: p.externalId,
    };

    const productData: Partial<Product> = {
      merchantId: mId,
      storefrontSlug,
      storefrontDomain,

      source: ProductSource.API,
      externalId: p.externalId,
      platform: provider,

      name: p.title ?? '',
      description: (p.raw as any)?.description ?? '',
      price: p.price ?? 0,
      isAvailable: (p.stock ?? 0) > 0,
      images: mapZidImageUrls((p.raw as any)?.images),

      // لا تضع category كاسم (اتركها فارغة لحين mapping لاحقًا)
      category: undefined,

      sourceUrl: (p.raw as any)?.permalink ?? null,
      originalUrl: (p.raw as any)?.permalink ?? null,

      keywords: [],
      syncStatus: 'ok',
      status: 'active',
    };

    const doc = await this.productModel.findOneAndUpdate(
      filter,
      { $set: productData, $setOnInsert: { createdAt: new Date() } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    await this.vectorService.upsertProducts([
      {
        id: doc._id.toString(),
        merchantId,
        name: doc.name,
        description: doc.description,
        category:
          typeof doc.category === 'object'
            ? String(doc.category)
            : (doc.category as any),
        specsBlock: doc.specsBlock,
        keywords: doc.keywords,
        url: (doc as any).publicUrl, // 👈 بالـ ID
      },
    ]);

    const existed = await this.productModel.exists(filter);
    const created = !(existed && (existed as any)._id?.equals(doc._id));
    return { created, id: doc._id.toString() };
  }

  async countByMerchant(merchantId: string): Promise<number> {
    return this.productModel.countDocuments({
      merchantId: new Types.ObjectId(merchantId),
    });
  }

  async findAllByMerchant(merchantObjectId: Types.ObjectId): Promise<any[]> {
    const docs = await this.productModel
      .find({ merchantId: merchantObjectId })
      .lean()
      .exec();

    // حول حقول الـ ObjectId إلى strings
    return docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
      merchantId: doc.merchantId.toString(),
    }));
  }
  // البحث حسب الاسم مهما كان متوفرًا أو لا
  async findByName(merchantId: string, name: string): Promise<any> {
    const mId = new Types.ObjectId(merchantId);
    const regex = new RegExp(name, 'i');
    return this.productModel
      .findOne({ merchantId: mId, name: regex })
      .lean()
      .exec();
  }
  async searchProducts(
    merchantId: string | Types.ObjectId,
    query: string,
  ): Promise<any[]> {
    const mId =
      typeof merchantId === 'string'
        ? new Types.ObjectId(merchantId)
        : merchantId;

    const normalized = normalizeQuery(query);
    const regex = new RegExp(escapeRegExp(normalized), 'i');

    // 1️⃣ محاولة التطابق الجزئي
    const partialMatches = await this.productModel
      .find({
        merchantId: mId,
        isAvailable: true,
        $or: [
          { name: regex },
          { description: regex },
          { category: regex },
          { keywords: { $in: [normalized] } },
        ],
      })
      .limit(10)
      .lean();

    if (partialMatches.length > 0) return partialMatches;

    // 2️⃣ محاولة البحث النصي الكامل
    try {
      const textMatches = await this.productModel
        .find(
          {
            merchantId: mId,
            $text: { $search: normalized },
            isAvailable: true,
          },
          { score: { $meta: 'textScore' } },
        )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      if (textMatches.length > 0) return textMatches;
    } catch (err) {
      console.warn('[searchProducts] Text index not found:', err.message);
    }

    // 3️⃣ fallback: تحليل كل كلمة على حدة (token match)
    const tokens = normalized.split(/\s+/);
    const tokenRegexes = tokens.map((t) => new RegExp(escapeRegExp(t), 'i'));

    const tokenMatches = await this.productModel
      .find({
        merchantId: mId,
        isAvailable: true,
        $or: [
          { name: { $in: tokenRegexes } },
          { description: { $in: tokenRegexes } },
          { category: { $in: tokenRegexes } },
          { keywords: { $in: tokens } },
        ],
      })
      .limit(10)
      .lean();

    return tokenMatches;
  }

  async setAvailability(productId: string, isAvailable: boolean) {
    const pId = new Types.ObjectId(productId);
    const product = await this.productModel
      .findByIdAndUpdate(pId, { isAvailable }, { new: true })
      .lean()
      .exec();

    return product;
  }
  // **هنا**: نجد أنّ return type هو ProductDocument
  async findOne(id: string): Promise<ProductDocument> {
    const prod = await this.productModel.findById(id).exec();
    if (!prod) throw new ProductNotFoundError(id);
    return prod;
  }
  async getProductByIdList(ids: string[], merchantId: string): Promise<any[]> {
    if (!ids.length) return [];

    return this.productModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        merchantId: new Types.ObjectId(merchantId),
      })
      .lean()
      .exec();
  }

  async getFallbackProducts(
    merchantId: string | Types.ObjectId,
    limit = 20,
  ): Promise<any[]> {
    const mId =
      typeof merchantId === 'string'
        ? new Types.ObjectId(merchantId)
        : merchantId;

    return this.productModel
      .find({ merchantId: mId, isAvailable: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async remove(id: string): Promise<{ message: string }> {
    const removed = await this.productModel.findByIdAndDelete(id).exec();
    if (!removed) throw new ProductNotFoundError(id);
    return { message: 'Product deleted successfully' };
  }

  // يمكنك وضع هذه الدالة في ProductsService:
  async createOrUpdateFromZid(merchantId: string, zidProduct: any) {
    const mId = new Types.ObjectId(merchantId);

    // اجلب بيانات واجهة المتجر لتوليد publicUrl لاحقًا
    const sf = await this.storefrontModel.findOne({ merchant: mId }).lean();
    const storefrontSlug = sf?.slug || undefined; // ← لا تستخدم null
    const storefrontDomain = sf?.domain || undefined; // ← لا تستخدم null

    // هل المنتج موجود؟
    const existing = await this.productModel.findOne({
      merchantId: mId,
      source: ProductSource.API,
      externalId: zidProduct.id,
    });

    // قصّ الصور إلى 6 فقط
    const images: string[] = Array.isArray(zidProduct.images)
      ? zidProduct.images
          .map((img: { url: string }) => img?.url)
          .filter(Boolean)
          .slice(0, 6)
      : [];

    // لا ترجع سلاسل فارغة؛ استخدم undefined لو ما فيه رابط
    const permalink: string | undefined = zidProduct?.permalink || undefined;

    // نبني بيانات التحديث/الإنشاء
    const docData: Partial<Product> = {
      merchantId: mId,

      storefrontSlug,
      storefrontDomain,

      source: ProductSource.API,
      externalId: zidProduct.id,
      platform: 'zid',

      name: zidProduct.name ?? '',
      description: zidProduct.description ?? '',
      price:
        typeof zidProduct.price === 'number'
          ? zidProduct.price
          : Number(zidProduct.price) || 0,
      isAvailable: Boolean(zidProduct.is_available),

      images,
      // اترك category غير محددة إن لم تكن ObjectId لديك:
      category: undefined,

      sourceUrl: permalink,
      originalUrl: permalink,

      keywords: [], // يمكنك توليدها لاحقًا
      status: 'active',
      syncStatus: 'ok',
    };

    let productDoc: ProductDocument | null;
    if (existing) {
      productDoc = await this.productModel.findByIdAndUpdate(
        existing._id,
        docData,
        { new: true },
      );
    } else {
      productDoc = await this.productModel.create(docData);
    }

    if (!productDoc) {
      throw new ProductNotFoundError(zidProduct.id);
    }

    // حدّث المتجهات مع URL عام بالـ ID (publicUrl virtual)
    await this.vectorService.upsertProducts([
      {
        id: productDoc._id.toString(),
        merchantId,
        name: productDoc.name,
        description: productDoc.description,
        category:
          typeof productDoc.category === 'object'
            ? productDoc.category?.toString()
            : (productDoc.category as any),
        specsBlock: productDoc.specsBlock,
        keywords: productDoc.keywords,
        url: (productDoc as any).publicUrl, // ← رابط بالـ ID
      },
    ]);

    return productDoc;
  }
  async removeByExternalId(
    merchantId: string,
    externalId: string,
  ): Promise<void> {
    await this.productModel.deleteOne({
      merchantId: new Types.ObjectId(merchantId),
      externalId,
      source: ProductSource.API,
    });
    // (اختياري) احذف من الفيكتور أيضا
    // await this.vectorService.removeProductEmbedding(externalId);
  }
}
