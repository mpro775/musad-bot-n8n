// src/analytics/analytics.service.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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
import { CreateMissingResponseDto } from './dto/create-missing-response.dto';
import {
  MissingResponse,
  MissingResponseDocument,
} from './schemas/missing-response.schema';
import { CreateKleemMissingResponseDto } from './dto/create-kleem-missing-response.dto';
import {
  KleemMissingResponse,
  KleemMissingResponseDocument,
} from './schemas/kleem-missing-response.schema';
import { QueryKleemMissingResponsesDto } from './dto/query-kleem-missing-responses.dto';
import { FaqService } from '../faq/faq.service';
import { AddToKnowledgeDto } from './dto/add-to-knowledge.dto';

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
  csat?: number; // 0..1
  firstResponseTimeSec?: number | null;
  missingOpen?: number;
  storeExtras?: { paidOrders: number; aov: number | null };
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
    @InjectModel(MissingResponse.name)
    private missingResponseModel: Model<MissingResponseDocument>,
    @InjectModel(KleemMissingResponse.name)
    private kleemMissingModel: Model<KleemMissingResponseDocument>,
    private faqService: FaqService,
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
  private async getCsat(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const r: Array<{ csat: number | null }> = await this.sessionModel.aggregate(
      [
        { $match: { merchantId, createdAt: { $gte: start, $lte: end } } },
        { $unwind: '$messages' },
        {
          $match: {
            'messages.role': 'bot',
            'messages.rating': { $in: [0, 1] },
          },
        },
        {
          $group: {
            _id: null,
            up: { $sum: { $cond: [{ $eq: ['$messages.rating', 1] }, 1, 0] } },
            dn: { $sum: { $cond: [{ $eq: ['$messages.rating', 0] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            csat: {
              $cond: [
                { $eq: [{ $add: ['$up', '$dn'] }, 0] },
                null,
                { $divide: ['$up', { $add: ['$up', '$dn'] }] },
              ],
            },
          },
        },
      ],
    );
    const value = r && Array.isArray(r) && r.length > 0 ? r[0].csat : null;
    return typeof value === 'number' || value === null ? value : null;
  }

  private async getFirstResponseTimeSec(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const r: Array<{ avgSec: number | null }> =
      await this.sessionModel.aggregate([
        { $match: { merchantId, createdAt: { $gte: start, $lte: end } } },
        {
          $project: {
            firstUser: {
              $min: {
                $map: {
                  input: {
                    $filter: {
                      input: '$messages',
                      as: 'm',
                      cond: { $eq: ['$$m.role', 'user'] },
                    },
                  },
                  as: 'm',
                  in: '$$m.timestamp',
                },
              },
            },
            firstBot: {
              $min: {
                $map: {
                  input: {
                    $filter: {
                      input: '$messages',
                      as: 'm',
                      cond: { $eq: ['$$m.role', 'bot'] },
                    },
                  },
                  as: 'm',
                  in: '$$m.timestamp',
                },
              },
            },
          },
        },
        // احسب الفرق فقط إذا عندنا أول رسالة مستخدم وبوت
        {
          $project: {
            diffSec: {
              $cond: [
                {
                  $and: [
                    '$firstUser',
                    '$firstBot',
                    { $gt: ['$firstBot', '$firstUser'] },
                  ],
                },
                { $divide: [{ $subtract: ['$firstBot', '$firstUser'] }, 1000] },
                null,
              ],
            },
          },
        },
        { $match: { diffSec: { $ne: null } } },
        { $group: { _id: null, avgSec: { $avg: '$diffSec' } } },
        { $project: { _id: 0, avgSec: { $round: ['$avgSec', 1] } } },
      ]);
    const value =
      r && Array.isArray(r) && r.length > 0 ? (r[0]?.avgSec ?? null) : null;
    return typeof value === 'number' || value === null ? value : null;
  }

  private async getMissingOpenCount(merchantId: Types.ObjectId) {
    return this.missingResponseModel.countDocuments({
      merchant: merchantId,
      resolved: false,
    });
  }

  private async getStoreExtras(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date,
  ) {
    // عدّ الطلبات المدفوعة واحسب AOV
    const paid = await this.orderModel.countDocuments({
      merchantId,
      createdAt: { $gte: start, $lte: end },
      status: 'paid',
    });
    const salesAgg = await this.orderModel.aggregate([
      {
        $match: {
          merchantId,
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'canceled' },
        },
      },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const revenue = salesAgg[0]?.total ?? 0;
    const aov = paid > 0 ? Number((revenue / paid).toFixed(2)) : null;
    return { paidOrders: paid, aov };
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
    if (merchant.channels?.whatsappQr?.enabled) enabledChannels.push('whatsapp');
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

    // (اختياري) احسب تغيّر الرسائل هنا إذا احتجته لاحقًا

    // المؤشرات الجديدة
    const [csat, frt, missingOpen, storeExtras] = await Promise.all([
      this.getCsat(mId, start, end),
      this.getFirstResponseTimeSec(mId, start, end),
      this.getMissingOpenCount(mId),
      this.getStoreExtras(mId, start, end),
    ]);

    // ثم أعِد النتيجة مع الحقول الجديدة:
    return {
      sessions: { count: currSessions, changePercent },
      messages: totalMessages, // (إن بغيت: messages: { count: totalMessages, changePercent: messagesChangePercent })
      topKeywords,
      topProducts,
      channels: { total: enabledChannels.length, breakdown },
      orders: {
        count: currOrders,
        changePercent: ordersChangePercent,
        byStatus: ordersByStatus,
        totalSales,
      },
      // إضافات
      csat: csat ?? undefined, // مثال: 0.87
      firstResponseTimeSec: frt ?? undefined, // مثال: 6.4
      missingOpen, // مثال: 14
      storeExtras, // { paidOrders: 32, aov: 127.5 }
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
  async createFromWebhook(dto: CreateMissingResponseDto) {
    // تحويل merchant ل ObjectId إن كان لديك Merchant فعلي
    const merchant = new Types.ObjectId(dto.merchant);
    return this.missingResponseModel.create({
      ...dto,
      merchant,
      resolved: dto.resolved ?? false,
    });
  }

  async listMissingResponses(params: {
    merchantId: string;
    page?: number;
    limit?: number;
    resolved?: 'all' | 'true' | 'false';
    channel?: 'telegram' | 'whatsapp' | 'webchat' | 'all';
    type?: 'missing_response' | 'unavailable_product' | 'all';
    search?: string;
    from?: string; // ISO
    to?: string; // ISO
  }) {
    const {
      merchantId,
      page = 1,
      limit = 20,
      resolved = 'all',
      channel = 'all',
      type = 'all',
      search,
      from,
      to,
    } = params;

    const q: any = { merchant: new Types.ObjectId(merchantId) };

    if (resolved !== 'all') q.resolved = resolved === 'true';
    if (channel !== 'all') q.channel = channel;
    if (type !== 'all') q.type = type;

    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    if (search && search.trim()) {
      q.$or = [
        { question: { $regex: search, $options: 'i' } },
        { botReply: { $regex: search, $options: 'i' } },
        { aiAnalysis: { $regex: search, $options: 'i' } },
        { sessionId: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.missingResponseModel
        .find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.missingResponseModel.countDocuments(q),
    ]);

    return { items, total, page, limit };
  }

  async markResolved(id: string, userId?: string) {
    return this.missingResponseModel.findByIdAndUpdate(
      id,
      { resolved: true, resolvedAt: new Date(), resolvedBy: userId ?? null },
      { new: true },
    );
  }

  async bulkResolveMarch(ids: string[], userId?: string) {
    const now = new Date();
    await this.missingResponseModel.updateMany(
      { _id: { $in: ids.map((i) => new Types.ObjectId(i)) } },
      { $set: { resolved: true, resolvedAt: now, resolvedBy: userId ?? null } },
    );
    return { updated: ids.length };
  }

  async stats(merchantId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const pipeline = [
      {
        $match: {
          merchant: new Types.ObjectId(merchantId),
          createdAt: { $gte: from },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } },
            channel: '$channel',
            resolved: '$resolved',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.day',
          channels: {
            $push: {
              channel: '$_id.channel',
              resolved: '$_id.resolved',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return this.missingResponseModel.aggregate(pipeline as any);
  }
  async addToKnowledge(params: {
    merchantId: string; // من التوكن
    missingId: string;
    payload: AddToKnowledgeDto;
    userId?: string;
  }) {
    const { merchantId, missingId, payload, userId } = params;

    const doc = await this.missingResponseModel.findById(missingId);
    if (!doc) throw new NotFoundException('Missing response not found');

    // تأكد أن الرسالة تخص نفس التاجر
    if (doc.merchant.toString() !== merchantId) {
      throw new ForbiddenException('Not your resource');
    }

    // أنشئ FAQ واحد عبر الخدمة (تتولى هي embeddings + Qdrant)
    const created = await this.faqService.createMany(merchantId, [
      {
        question: payload.question,
        answer: payload.answer,
      },
    ]);

    // علِّم الرسالة كمُعالج
    doc.resolved = true;
    doc.resolvedAt = new Date();
    doc.resolvedBy = userId ?? undefined;
    await doc.save();

    return {
      success: true,
      faqId: created[0]?._id,
      missingResponseId: doc._id,
      resolved: true,
    };
  }
  async createKleemFromWebhook(
    dto: CreateKleemMissingResponseDto,
  ): Promise<KleemMissingResponseDocument> {
    // تنظيف بسيط (اختياري)
    dto.question = (dto.question || '').trim();
    if (dto.botReply) dto.botReply = dto.botReply.trim();

    return await this.kleemMissingModel.create({
      ...dto,
      resolved: dto.resolved ?? false,
    });
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
  async listKleemMissing(dto: QueryKleemMissingResponsesDto) {
    const {
      page,
      limit,
      channel,
      resolved,
      q,
      sessionId,
      customerId,
      from,
      to,
    } = dto;

    const filter: FilterQuery<KleemMissingResponseDocument> = {};
    if (channel) filter.channel = channel;
    if (resolved === 'true') filter.resolved = true;
    if (resolved === 'false') filter.resolved = false;
    if (sessionId) filter.sessionId = sessionId;
    if (customerId) filter.customerId = customerId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (q) {
      filter.$or = [
        { question: { $regex: q, $options: 'i' } },
        { aiAnalysis: { $regex: q, $options: 'i' } },
        { manualReply: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.kleemMissingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.kleemMissingModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async updateKleemMissing(
    id: string,
    update: Partial<
      Pick<KleemMissingResponse, 'resolved' | 'manualReply' | 'category'>
    >,
  ) {
    return this.kleemMissingModel
      .findByIdAndUpdate(
        id,
        {
          ...(update.manualReply !== undefined
            ? { manualReply: update.manualReply }
            : {}),
          ...(update.category !== undefined
            ? { category: update.category }
            : {}),
          ...(update.resolved !== undefined
            ? { resolved: update.resolved }
            : {}),
        },
        { new: true },
      )
      .lean();
  }

  async bulkResolve(ids: string[]) {
    await this.kleemMissingModel.updateMany(
      { _id: { $in: ids } },
      { $set: { resolved: true } },
    );
    return { updated: ids.length };
  }
}
