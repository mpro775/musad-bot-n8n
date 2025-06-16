// src/modules/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { UpdateProductDto } from './dto/update-product.dto';
import { ScrapeQueue } from './scrape.queue';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly scrapeQueue: ScrapeQueue,
  ) {}

  async create(
    data: Partial<Product> & { merchantId: string | Types.ObjectId },
  ): Promise<ProductDocument> {
    const dto = {
      ...data,
      merchantId:
        typeof data.merchantId === 'string'
          ? new Types.ObjectId(data.merchantId)
          : data.merchantId,
    };
    const product = await this.productModel.create(dto);

    // → اضف هذه السطور فور الإنشاء
    await this.enqueueScrapeJob({
      productId: product._id.toString(),
      url: product.originalUrl,
      merchantId: product.merchantId.toString(),
      mode: 'full',
    });

    return product;
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

  // **هنا**: نجد أنّ return type هو ProductDocument
  async findOne(id: string): Promise<ProductDocument> {
    const prod = await this.productModel.findById(id).exec();
    if (!prod) throw new NotFoundException('Product not found');
    return prod;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const updated = await this.productModel
      .findByIdAndUpdate(id, dto, {
        new: true,
      })
      .exec();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const removed = await this.productModel.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException('Product not found');
    return { message: 'Product deleted successfully' };
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
      .find()
      .select('_id originalUrl merchantId lastFetchedAt')
      .exec();
    const now = Date.now();

    for (const p of products) {
      // إذا مضى أكثر من 10 دقائق عن آخر فحص
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
