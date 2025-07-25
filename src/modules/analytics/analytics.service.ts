// src/analytics/analytics.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import dayjs from 'dayjs';
import {
  MessageSession,
  MessageSessionDocument,
} from '../messaging/schemas/message.schema';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface ChannelCount {
  channel: string;
  count: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  count: number;
}

export interface Overview {
  sessions: { count: number; changePercent: number };
  messages: number;
  topKeywords: KeywordCount[];
  topProducts: TopProduct[];
  channels: { total: number; breakdown: ChannelCount[] };
  orders: {
    count: number;
    changePercent: number;
    byStatus: Record<string, number>;
    totalSales: number;
  };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MessageSession.name)
    private readonly sessionModel: Model<MessageSessionDocument>,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  /**
   * يحسب تواريخ البداية والنهاية للفترة المحددة.
   * يدعم 'week'، 'month'، و 'quarter' يدويًا.
   */
  private getPeriodDates(period: 'week' | 'month' | 'quarter'): {
    start: Date;
    end: Date;
  } {
    let start: Date, end: Date;
    if (period === 'week' || period === 'month') {
      end = dayjs().endOf(period).toDate();
      start = dayjs(end).subtract(1, period).toDate();
    } else {
      const now = dayjs();
      const m = now.month();
      const qStart = Math.floor(m / 3) * 3;
      start = now.month(qStart).startOf('month').toDate();
      end = now
        .month(qStart + 2)
        .endOf('month')
        .toDate();
    }
    return { start, end };
  }

  /**
   * يجمع الإحصاءات الأساسية: عدد الجلسات، إجمالي الرسائل،
   * أعلى الكلمات المفتاحية، أعلى المنتجات طلبًا، وتفصيل القنوات.
   */
  async getOverview(
    merchantId: string,
    period: 'week' | 'month' | 'quarter',
  ): Promise<Overview> {
    // حساب تواريخ الفترة الحالية والسابقة
    const { start, end } = this.getPeriodDates(period);
    let prevStart: Date;
    let prevEnd: Date;

    if (period === 'week' || period === 'month') {
      prevStart = dayjs(start).subtract(1, period).toDate();
      prevEnd = dayjs(start).toDate();
    } else {
      prevStart = dayjs(start).subtract(3, 'month').toDate();
      prevEnd = start;
    }

    const mId = new Types.ObjectId(merchantId);

    // 1) عدد الجلسات الحالية والسابقة
    const [currSessions, prevSessions] = await Promise.all([
      this.sessionModel.countDocuments({
        merchantId: mId,
        createdAt: { $gte: start, $lte: end },
      }),
      this.sessionModel.countDocuments({
        merchantId: mId,
        createdAt: { $gte: prevStart, $lte: prevEnd },
      }),
    ]);
    const changePercent = prevSessions
      ? Math.round(((currSessions - prevSessions) / prevSessions) * 100)
      : 100;

    // 2) إجمالي عدد الرسائل خلال الفترة
    const messagesAgg = await this.sessionModel.aggregate<{
      _id: null;
      total: number;
    }>([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $project: { count: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);
    const totalMessages = messagesAgg.length > 0 ? messagesAgg[0].total : 0;

    const [currOrders, prevOrders] = await Promise.all([
      this.orderModel.countDocuments({
        merchantId: mId,
        createdAt: { $gte: start, $lte: end },
      }),
      this.orderModel.countDocuments({
        merchantId: mId,
        createdAt: { $gte: prevStart, $lte: prevEnd },
      }),
    ]);
    const ordersChangePercent = prevOrders
      ? Math.round(((currOrders - prevOrders) / prevOrders) * 100)
      : 100;

    // 2) تفصيل حسب الحالة
    const orderStatusAgg = await this.orderModel.aggregate([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    // حول الـ aggregate إلى كائن مثل {pending: 2, paid: 5, ...}
    const ordersByStatus = {};
    orderStatusAgg.forEach((s) => {
      ordersByStatus[s._id] = s.count;
    });

    // 3) اجمالي المبيعات (مجموع مبلغ الطلبات)
    const salesAgg = await this.orderModel.aggregate([
      {
        $match: {
          merchantId: mId,
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'canceled' },
        },
      },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const totalSales = salesAgg[0]?.total || 0;
    // 3) أعلى 3 كلمات مفتاحية
    const topKeywords = await this.sessionModel.aggregate<KeywordCount>([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$messages' },
      { $unwind: '$messages.keywords' },
      { $group: { _id: '$messages.keywords', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { keyword: '$_id', count: 1, _id: 0 } },
    ]);

    // 4) أعلى 3 منتجات طلبًا عبر نقرات رابط التتبع
    const topProducts = await this.sessionModel.aggregate<TopProduct>([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$messages' },
      { $match: { 'messages.metadata.event': 'product_click' } },
      { $group: { _id: '$messages.metadata.productId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          count: 1,
          _id: 0,
        },
      },
    ]);

    // 5) جلب القنوات المفعلة من التاجر مباشرة
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }
    const enabledChannels: string[] = [];
    if (merchant.channels?.telegram?.enabled) enabledChannels.push('telegram');
    if (merchant.channels?.whatsapp?.enabled) enabledChannels.push('whatsapp');
    if (merchant.channels?.webchat?.enabled) enabledChannels.push('webchat');

    // 6) تجميع usage لكل قناة من الـ Sessions
    const channelsUsage = await this.sessionModel.aggregate<ChannelCount>([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $project: { channel: '$_id', count: 1, _id: 0 } },
    ]);

    // 7) بناء breakdown النهائي للقنوات: جميع القنوات المفعلة حتى لو usage=0
    const breakdown: ChannelCount[] = enabledChannels.map((channel) => ({
      channel,
      count: channelsUsage.find((c) => c.channel === channel)?.count || 0,
    }));

    return {
      sessions: {
        count: currSessions,
        changePercent,
      },
      messages: totalMessages,
      topKeywords,
      topProducts,
      channels: {
        total: enabledChannels.length,
        breakdown,
      },
      orders: {
        count: currOrders,
        changePercent: ordersChangePercent,
        byStatus: ordersByStatus,
        totalSales,
      },
    };
  }
  async getMessagesTimeline(
    merchantId: string,
    period: 'week' | 'month' | 'quarter' = 'week',
    groupBy: 'day' | 'hour' = 'day',
  ) {
    const { start, end } = this.getPeriodDates(period);
    const mId = new Types.ObjectId(merchantId);

    // حدد صيغة التجميع حسب groupBy
    const dateFormat = groupBy === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';

    return this.sessionModel.aggregate([
      { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$messages' },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$messages.timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getTopKeywords(
    merchantId: string,
    period: 'week' | 'month' | 'quarter',
    limit = 10,
  ): Promise<KeywordCount[]> {
    const { start, end } = this.getPeriodDates(period);
    const mId = new Types.ObjectId(merchantId);

    return this.sessionModel
      .aggregate<KeywordCount>([
        { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
        { $unwind: '$messages' },
        { $unwind: '$messages.keywords' },
        { $group: { _id: '$messages.keywords', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { keyword: '$_id', count: 1, _id: 0 } },
      ])
      .then((res) => res);
  }
  async getProductsCount(merchantId: string) {
    const mId = new Types.ObjectId(merchantId);
    return this.productModel.countDocuments({ merchantId: mId });
  }

  async getTopProducts(
    merchantId: string,
    period: 'week' | 'month' | 'quarter',
    limit = 5,
  ): Promise<TopProduct[]> {
    const { start, end } = this.getPeriodDates(period);
    const mId = new Types.ObjectId(merchantId);

    return this.sessionModel
      .aggregate<TopProduct>([
        { $match: { merchantId: mId, createdAt: { $gte: start, $lte: end } } },
        { $unwind: '$messages' },
        { $match: { 'messages.metadata.event': 'product_click' } },
        { $group: { _id: '$messages.metadata.productId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            productId: '$_id',
            name: '$product.name',
            count: 1,
            _id: 0,
          },
        },
      ])
      .then((res) => res);
  }
}
