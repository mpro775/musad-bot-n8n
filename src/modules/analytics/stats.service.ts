// src/modules/analytics/services/stats.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';
import { Stats, StatsDocument } from './schemas/stats.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly eventModel: Model<AnalyticsEventDocument>,

    @InjectModel(Stats.name)
    private readonly statsModel: Model<StatsDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  /**
   * يحسب بداية ونهاية الفترة بناءً على النوع
   */
  private getRange(period: 'daily' | 'weekly' | 'monthly', refDate: Date) {
    const start = new Date(refDate);
    let end = new Date(refDate);

    if (period === 'daily') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
      // اعتبار الأسبوع من الأحد
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0); // آخر يوم في الشهر
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  /**
   * Cron job للحساب اليومي (منتجات + رسائل)
   */
  @Cron('0 1 * * *') // كل يوم الساعة 01:00
  async aggregateDaily() {
    const { start, end } = this.getRange('daily', new Date());
    await this.aggregatePeriod('daily', start, end);
  }

  /**
   * Cron job للحساب الأسبوعي (منتجات + رسائل)
   */
  @Cron('0 5 * * 0') // كل أسبوع يوم الأحد الساعة 05:00
  async aggregateWeekly() {
    const { start, end } = this.getRange('weekly', new Date());
    await this.aggregatePeriod('weekly', start, end);
  }

  /**
   * Cron job للحساب الشهري (منتجات + رسائل)
   */
  @Cron('0 10 1 * *') // كل شهر في اليوم الأول الساعة 10:00
  async aggregateMonthly() {
    const { start, end } = this.getRange('monthly', new Date());
    await this.aggregatePeriod('monthly', start, end);
  }

  /**
   * جزئية 5.2: تجميع الرسائل وعدد المنتجات للفترة المحددة
   */
  private async aggregatePeriod(
    period: 'daily' | 'weekly' | 'monthly',
    start: Date,
    end: Date,
  ) {
    // 1. الحصول على قائمة التجار الذين لديهم أحداث في هذه الفترة
    const merchantIds: Types.ObjectId[] = await this.eventModel.distinct(
      'merchantId',
      {
        createdAt: { $gte: start, $lte: end },
      },
    );

    for (const merchantId of merchantIds) {
      // 2. عدّ المنتجات
      const productCount = await this.productModel.countDocuments({
        merchantId,
      });

      // 3. تجميع الرسائل حسب القناة
      const messagesByChannel = await this.eventModel.aggregate([
        {
          $match: {
            merchantId,
            type: { $in: ['chat_in', 'chat_out'] },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            channel: '$_id',
            count: 1,
          },
        },
      ]);

      // 4. تخزين النتائج أو تحديثها
      await this.statsModel.updateOne(
        { merchantId, period, date: start },
        {
          $set: {
            merchantId,
            period,
            date: start,
            productCount,
            messagesByChannel,
          },
        },
        { upsert: true },
      );
    }
  }

  /**
   * لاسترجاع الإحصائيات عبر API
   */
  async findStats(
    merchantId: string,
    period: 'daily' | 'weekly' | 'monthly',
    date: Date,
  ): Promise<StatsDocument | null> {
    return this.statsModel.findOne({ merchantId, period, date }).lean();
  }
}
