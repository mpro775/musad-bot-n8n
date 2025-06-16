// src/modules/offers/offers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Offer, OfferDocument } from './schemas/offer.schema';
import { ScrapeQueue } from './scrape.queue';
import { UpdateOfferDto } from './dto/update-offer.dto';

export interface OfferJobData {
  offerId: string;
  url: string;
  merchantId: string;
  mode: 'full' | 'minimal';
}

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    private readonly scrapeQueue: ScrapeQueue,
  ) {}

  /**
   * إنشاء عرض جديد مع إضافة مهمة Scrape
   */
  async create(
    data: Partial<Offer> & { merchantId: string | Types.ObjectId },
  ): Promise<OfferDocument> {
    const dto = {
      ...data,
      merchantId:
        typeof data.merchantId === 'string'
          ? new Types.ObjectId(data.merchantId)
          : data.merchantId,
    };
    const offer = await this.offerModel.create(dto);

    // عند الإنشاء، أضف مهمة Scrape بنمط "full"
    await this.enqueueScrapeJob({
      offerId: offer._id.toString(),
      url: offer.originalUrl,
      merchantId: offer.merchantId.toString(),
      mode: 'full',
    });

    return offer;
  }

  /**
   * إضافة مهمة إلى طابور السكربنج
   */
  async enqueueScrapeJob(jobData: OfferJobData): Promise<void> {
    await this.scrapeQueue.addJob(jobData);
  }

  /**
   * جلب جميع العروض لتاجر محدد
   */
  async findAllByMerchant(merchantObjectId: Types.ObjectId): Promise<any[]> {
    const docs = await this.offerModel
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

  /**
   * جلب عرض واحد حسب المعرّف
   */
  async findOne(id: string): Promise<OfferDocument> {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  /**
   * تحديث بيانات عرض
   */
  async update(id: string, dto: UpdateOfferDto): Promise<OfferDocument> {
    const updated = await this.offerModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Offer not found');
    }
    return updated;
  }

  /**
   * حذف عرض
   */
  async remove(id: string): Promise<{ message: string }> {
    const removed = await this.offerModel.findByIdAndDelete(id).exec();
    if (!removed) {
      throw new NotFoundException('Offer not found');
    }
    return { message: 'Offer deleted successfully' };
  }

  /**
   * تحديث البيانات بعد عملية السكربنج
   */
  async updateAfterScrape(
    offerId: string,
    updateData: Partial<Offer>,
  ): Promise<OfferDocument> {
    const updated = await this.offerModel
      .findByIdAndUpdate(offerId, updateData, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Offer not found');
    }
    return updated;
  }

  /**
   * Cron لتحديث البيانات بشكل دوري (minimal) كل 10 دقائق
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleMinimalScrape(): Promise<void> {
    const offers = await this.offerModel
      .find()
      .select('_id originalUrl merchantId lastFetchedAt')
      .exec();
    const now = Date.now();

    for (const o of offers) {
      if (
        !o.lastFetchedAt ||
        now - o.lastFetchedAt.getTime() > 10 * 60 * 1000
      ) {
        await this.enqueueScrapeJob({
          offerId: o._id.toString(),
          url: o.originalUrl,
          merchantId: o.merchantId.toString(),
          mode: 'minimal',
        });
      }
    }
  }
}
