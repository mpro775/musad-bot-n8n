// src/storefront/storefront.service.ts
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { UpdateStorefrontDto } from './dto/update-storefront.dto';
import { Storefront, StorefrontDocument } from './schemas/storefront.schema';
import { CreateStorefrontDto } from './dto/create-storefront.dto';
import { FilterQuery } from 'mongoose';
import { VectorService } from '../vector/vector.service';
import * as Minio from 'minio';
import { unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { LeadsService } from '../leads/leads.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
export interface StorefrontResult {
  merchant: any;
  products: any[];
  categories: any[];
}
@Injectable()
export class StorefrontService {
  private readonly MAX_BANNERS = 5;

  // ====== تحجيم مع الحفاظ على النسبة إلى ≤ 5 ميجا بكسل ======
  private async processToMaxMegapixels(
    inputPath: string,
    maxMP = 5,
  ): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    const MAX_PIXELS = Math.floor(maxMP * 1_000_000);

    const img = sharp(inputPath, { failOn: 'none' });
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w <= 0 || h <= 0) throw new BadRequestException('لا يمكن قراءة أبعاد الصورة');

    let pipeline = img;
    const total = w * h;

    // إن كانت أكبر من 5MP نقلّص بالأبعاد الفعلية مع الحفاظ على النسبة
    if (total > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / total); // نسبة التصغير
      const newW = Math.max(1, Math.floor(w * scale));
      const newH = Math.max(1, Math.floor(h * scale));
      pipeline = pipeline.resize(newW, newH, { fit: 'inside', withoutEnlargement: true });
    }

    // نُخرج WEBP بجودة مناسبة (يدعم الشفافية والنِسَب العريضة للبانرات)
    const buffer = await pipeline.webp({ quality: 80 }).toBuffer();
    return { buffer, mime: 'image/webp', ext: 'webp' };
  }

  // ====== رفع صور البنرات (≤5 إجماليًا) ======
  async uploadBannerImagesToMinio(
    merchantId: string,
    files: Express.Multer.File[],
  ): Promise<{
    urls: string[];
    accepted: number;
    remaining: number;
    max: number;
  }> {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    const bucket = process.env.MINIO_BUCKET!;
    await this.ensureBucket(bucket);

    // احضر storefront لحساب المتبقي
    const sf = await this.findByMerchant(merchantId);
    const currentCount = sf?.banners?.length ?? 0;

    if (currentCount >= this.MAX_BANNERS) {
      // لا يوجد أي خانة متاحة
      // تنظيف الملفات المؤقتة
      await Promise.all(files.map(f => unlink(f.path).catch(() => {})));
      throw new BadRequestException(`لا يمكن إضافة المزيد من البنرات: الحد الأقصى ${this.MAX_BANNERS}.`);
    }

    const availableSlots = Math.max(0, this.MAX_BANNERS - currentCount);
    const toProcess = files.slice(0, availableSlots);

    const urls: string[] = [];
    let i = 0;

    for (const file of toProcess) {
      if (!allowed.includes(file.mimetype)) {
        await unlink(file.path).catch(() => {});
        throw new BadRequestException('صيغة الصورة غير مدعومة (PNG/JPG/WEBP).');
      }

      try {
        const out = await this.processToMaxMegapixels(file.path, 5); // ≤5MP
        const key = `merchants/${merchantId}/storefront/banners/banner-${Date.now()}-${i++}.${out.ext}`;

        // نرفع البافر مباشرة (لا نحتاج fPutObject على المسار)
        await this.minio.fPutObject(bucket, key, file.path, {
          'Content-Type': file.mimetype,
        });

        const url = await this.publicUrlFor(bucket, key);
        urls.push(url);
      } finally {
        await unlink(file.path).catch(() => {});
      }
    }

    return {
      urls,
      accepted: toProcess.length,
      remaining: Math.max(0, this.MAX_BANNERS - (currentCount + toProcess.length)),
      max: this.MAX_BANNERS,
    };
  }

  // ====== Helpers للتخزين (موجودة لديك – نعيدها للوضوح) ======
  private async ensureBucket(bucket: string) {
    const exists = await this.minio.bucketExists(bucket).catch(() => false);
    if (!exists) await this.minio.makeBucket(bucket, '');
  }

  private async publicUrlFor(bucket: string, key: string): Promise<string> {
    const cdnBase = (process.env.ASSETS_CDN_BASE_URL || '').replace(/\/+$/, '');
    const minioPublic = (process.env.MINIO_PUBLIC_URL || '').replace(/\/+$/, '');
    if (cdnBase) return `${cdnBase}/${bucket}/${key}`;
    if (minioPublic) return `${minioPublic}/${bucket}/${key}`;
    return this.minio.presignedUrl('GET', bucket, key, 7 * 24 * 60 * 60);
  }

  constructor(
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Storefront.name)
    private storefrontModel: Model<StorefrontDocument>,
    private vectorService: VectorService,
    @Inject('MINIO_CLIENT') private readonly minio: Minio.Client,
    private readonly leads: LeadsService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}
  async create(dto: CreateStorefrontDto): Promise<Storefront> {
    return this.storefrontModel.create(dto);
  }

  async update(id: string, dto: UpdateStorefrontDto): Promise<Storefront> {
    const before = await this.storefrontModel.findById(id);
    if (!before) throw new NotFoundException('Storefront not found');

    const updated = await this.storefrontModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Storefront not found');

    const slugChanged   = dto.slug   && dto.slug   !== before.slug;
    const domainChanged = dto.domain !== undefined && dto.domain !== before.domain;

    if (slugChanged || domainChanged) {
      await this.productModel.updateMany(
        { merchantId: updated.merchant },
        {
          ...(slugChanged   ? { storefrontSlug: updated.slug } : {}),
          ...(domainChanged ? { storefrontDomain: updated.domain ?? null } : {}),
        } as any,
      );
      // إعادة فهرسة URL في المتجهات (سريع: نجلب ids فقط ثم نقرأ كل منتج لحساب publicUrl)
      const ids = await this.productModel
        .find({ merchantId: updated.merchant })
        .select('_id')
        .lean();

      for (const { _id } of ids) {
        const p = await this.productModel.findById(_id).lean();
        if (!p) continue;
        await this.vectorService.upsertProducts([{
          id: String(p._id),
          merchantId: String(p.merchantId),
          name: p.name,
          description: p.description,
          category: p.category ? String(p.category) : undefined,
          specsBlock: p.specsBlock,
          keywords: p.keywords,
          url: (p as any).publicUrl, // virtual محسوب من الحقول بعد التحديث
        }]);
      }
    }

    return updated;
  }

  async getStorefront(slugOrId: string): Promise<StorefrontResult> {
    // احضر storefront عبر slug أو _id
    const sf = await this.storefrontModel
      .findOne(
        Types.ObjectId.isValid(slugOrId)
          ? { $or: [{ _id: slugOrId }, { slug: slugOrId }] }
          : { slug: slugOrId },
      )
      .lean();

    if (!sf) throw new NotFoundException('Storefront not found');

    // ثم احضر merchant المرتبط
    const merchant = await this.merchantModel.findById(sf.merchant).lean();
    if (!merchant) throw new NotFoundException('Merchant not found');

    const products = await this.productModel
      .find({ merchantId: merchant._id, status: 'active', isAvailable: true })
      .sort({ createdAt: -1 })
      .lean();

    const categories = await this.categoryModel
      .find({ merchantId: merchant._id })
      .sort({ name: 1 })
      .lean();

    return { merchant, products, categories };
  }
  async deleteByMerchant(merchantId: string) {
    await this.storefrontModel.deleteOne({ merchant: merchantId }).exec();
  }
  private merchantFilter(merchantId: string): FilterQuery<Storefront> {
    // نبحث بالـ string وبـ ObjectId لو صالح
    const or: any[] = [{ merchant: merchantId }];
    if (Types.ObjectId.isValid(merchantId)) {
      or.push({ merchant: new Types.ObjectId(merchantId) });
    }
    return { $or: or };
  }

  private normalizeSlug(input: string): string {
    let s = (input || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    s = s.replace(/[^a-z0-9-]/g, '');
    s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length < 3 || s.length > 50) {
      throw new BadRequestException('slug يجب أن يكون بين 3 و 50 حرفًا');
    }
    return s;
  }

  async checkSlugAvailable(slug: string): Promise<{ available: boolean }> {
    if (!slug) throw new BadRequestException('slug مطلوب');
    const n = this.normalizeSlug(slug);
    const exists = await this.storefrontModel.exists({ slug: n }).lean();
    return { available: !exists };
  }

  async findByMerchant(merchantId: string): Promise<StorefrontDocument | null> {
    return this.storefrontModel.findOne(this.merchantFilter(merchantId)).exec();
  }
  async updateByMerchant(merchantId: string, dto: UpdateStorefrontDto) {
    let sf = await this.storefrontModel.findOne(
      this.merchantFilter(merchantId),
    );
    if (!sf) {
      // إنشاء افتراضي إن لم توجد (علشان ما ترجع 404 للتجّار القدامى)
      const base: Partial<Storefront> = {
        merchant: Types.ObjectId.isValid(merchantId)
          ? new Types.ObjectId(merchantId)
          : (merchantId as any),
        primaryColor: '#FF8500',
        secondaryColor: '#1976d2',
        buttonStyle: 'rounded',
        slug: undefined!,
      };
      if (dto.slug) {
        const n = this.normalizeSlug(dto.slug);
        const conflict = await this.storefrontModel.exists({ slug: n }).lean();
        if (conflict) throw new BadRequestException('هذا الـ slug محجوز');
        base.slug = n;
      } else {
        // توليد slug افتراضي (merchantId أو merchant.name عند الحاجة)
        const fallback = Types.ObjectId.isValid(merchantId)
          ? merchantId.toString().slice(-8)
          : merchantId;
        let n = this.normalizeSlug(`store-${fallback}`);
        // حلّ تعارض تلقائيًا
        let i = 1;
        while (await this.storefrontModel.exists({ slug: n }).lean()) {
          n = this.normalizeSlug(`store-${fallback}-${i++}`);
        }
        base.slug = n;
      }
      sf = await this.storefrontModel.create(
        base as unknown as CreateStorefrontDto,
      );
    }

    // لا نسمح بتعديل merchant من البودي
    const update: Partial<Storefront> = { ...(dto as any) };
    delete (update as any).merchant;

    if (dto.slug) {
      const n = this.normalizeSlug(dto.slug);
      const conflict = await this.storefrontModel.exists({
        slug: n,
        _id: { $ne: sf._id },
      });
      if (conflict) throw new BadRequestException('هذا الـ slug محجوز');
      update.slug = n;
    }

    Object.assign(sf, update);
    await sf.save();
    return sf;
  }
  async getMyOrdersForSession(merchantId: string, sessionId: string) {
    const phone = await this.leads.getPhoneBySession(merchantId, sessionId);

    const filter: any = { merchantId, $or: [{ sessionId }] };
    if (phone) filter.$or.push({ 'customer.phone': phone });

    const orders = await this.orderModel.find(filter).sort({ createdAt: -1 }).lean();
    return { orders };
  }
}
