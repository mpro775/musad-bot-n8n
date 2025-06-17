// src/modules/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { UpdateProductDto } from './dto/update-product.dto';
import { ScrapeQueue } from './scrape.queue';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateProductDto, ProductSource } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly scrapeQueue: ScrapeQueue,
  ) {}

  async create(
    dto: CreateProductDto & { merchantId: string },
  ): Promise<ProductDocument> {
    const merchantId = new Types.ObjectId(dto.merchantId);
    const uniqueKey = `${dto.merchantId}|${
      dto.source === ProductSource.API ? dto.externalId : dto.originalUrl
    }`;
    const product = new this.productModel({
      merchantId,
      originalUrl: dto.originalUrl,
      platform: dto.platform || '',
      name: dto.name || '',
      description: dto.description || '',
      price: dto.price || 0,
      isAvailable: dto.isAvailable ?? true,
      images: dto.images || [],
      category: dto.category || '',
      lowQuantity: dto.lowQuantity || '',
      specsBlock: dto.specsBlock || [],
      lastFetchedAt: dto.lastFetchedAt || null,
      lastFullScrapedAt: dto.lastFullScrapedAt || null,
      errorState: 'queued',
      source: dto.source,
      sourceUrl: dto.sourceUrl || null,
      externalId: dto.externalId || null,
      status: 'active',
      lastSync: null,
      syncStatus: 'pending',
      offers: [],
      keywords: dto.keywords || [],
      uniqueKey,
    });
    await product.save();
    if (dto.source !== ProductSource.MANUAL) {
      await this.enqueueScrapeJob({
        productId: product._id.toString(),
        url: dto.sourceUrl || dto.originalUrl,
        merchantId: dto.merchantId,
        mode: dto.source === ProductSource.API ? 'full' : 'minimal',
      });
    }
    return product;
  }
  async countByMerchant(merchantId: string): Promise<number> {
    return this.productModel.countDocuments({
      merchantId: new Types.ObjectId(merchantId),
    });
  }
  async enqueueScrapeJob(jobData: {
    productId: string;
    url: string;
    merchantId: string;
    mode: 'full' | 'minimal';
  }) {
    return this.scrapeQueue.addJob(jobData);
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
  async findByName(
    merchantId: string,
    name: string,
  ): Promise<ProductDocument | null> {
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
  ): Promise<ProductDocument[]> {
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
    if (!prod) throw new NotFoundException('Product not found');
    return prod;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    // Prevent source change
    delete (dto as any).source;
    const updated = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async getFallbackProducts(
    merchantId: string | Types.ObjectId,
    limit = 20,
  ): Promise<ProductDocument[]> {
    const mId =
      typeof merchantId === 'string'
        ? new Types.ObjectId(merchantId)
        : merchantId;

    return this.productModel
      .find({ merchantId: mId, isAvailable: true })
      .sort({ lastFetchedAt: -1 }) // أو { createdAt: -1 } حسب ما يناسب
      .limit(limit)
      .lean()
      .exec();
  }

  async remove(id: string): Promise<{ message: string }> {
    const removed = await this.productModel.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException('Product not found');
    return { message: 'Product deleted successfully' };
  }

  async triggerSync(id: string): Promise<ProductDocument> {
    const product = await this.findOne(id);
    if (product.source === 'manual') {
      throw new NotFoundException('Cannot sync manual products');
    }
    await this.enqueueScrapeJob({
      productId: id,
      url: product.sourceUrl || product.originalUrl,
      merchantId: product.merchantId.toString(),
      mode: 'full',
    });
    return product;
  }

  async updateAfterScrape(
    productId: string,
    updateData: Partial<Product>,
  ): Promise<ProductDocument> {
    const updated = await this.productModel
      .findByIdAndUpdate(productId, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Product not found');

    return updated;
  }
  /**
   * يمر كل 10 دقائق على جميع المنتجات ويجدّد السعر والتوفّر فقط
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleMinimalScrape() {
    const products = await this.productModel
      .find({ source: { $in: ['api', 'scraper'] } })
      .select(' _id originalUrl merchantId lastFetchedAt')
      .exec();
    const now = Date.now();
    for (const p of products) {
      if (
        !p.lastFetchedAt ||
        now - p.lastFetchedAt.getTime() > 10 * 60 * 1000
      ) {
        await this.enqueueScrapeJob({
          productId: p._id.toString(),
          url: p.originalUrl,
          merchantId: p.merchantId.toString(),
          mode: 'minimal',
        });
      }
    }
  }
}

/**
 * هروب من الأحرف الخاصة في Regex
 */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[؟?]/g, '')
    .replace(
      /\b(هل|عندك|عندكم|فيه|يتوفر|أحتاج|أبي|ابغى|ممكن|وش|شو|ايش|لو سمحت)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/كايبلات|كيبلات|كابلات|كابلات|كبلات/gi, 'كيبل')
    .replace(/سماعات|سماعه|هيدفون/gi, 'سماعة')
    .replace(/شواحن|شاحنات/gi, 'شاحن')
    .trim();
}
