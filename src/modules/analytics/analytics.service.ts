import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MessageSession,
  MessageSessionDocument,
} from '../messaging/schemas/message.schema';
type RoleStats = Record<'customer' | 'bot' | string, number>;
type DailySessionStat = {
  date: string; // e.g. "2025-06-12"
  count: number;
};
type ChannelStat = {
  channel: string;
  count: number;
};
type KeywordStat = {
  word: string;
  count: number;
};
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MessageSession.name)
    private readonly sessionModel: Model<MessageSessionDocument>,
  ) {}

  async countSessions(
    merchantId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const result: { sessionCount: number }[] =
      await this.sessionModel.aggregate([
        {
          $match: {
            merchantId,
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $count: 'sessionCount',
        },
      ]);

    return result.length > 0 ? result[0].sessionCount : 0;
  }

  async countMessagesByRole(merchantId: string): Promise<RoleStats> {
    const result: { _id: string; count: number }[] =
      await this.sessionModel.aggregate([
        { $match: { merchantId } },
        { $unwind: '$messages' },
        { $group: { _id: '$messages.role', count: { $sum: 1 } } },
      ]);

    return result.reduce<RoleStats>((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});
  }

  async topCustomerMessages(merchantId: string, limit = 10): Promise<any[]> {
    return await this.sessionModel.aggregate([
      { $match: { merchantId } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'customer' } },
      {
        $group: {
          _id: '$messages.text',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
  }

  async sessionsPerDay(
    merchantId: string,
    from: Date,
    to: Date,
  ): Promise<DailySessionStat[]> {
    const sessions: { _id: string; count: number }[] =
      await this.sessionModel.aggregate([
        {
          $match: {
            merchantId,
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

    return sessions.map((s) => ({
      date: s._id,
      count: s.count,
    }));
  }

  async channelDistribution(merchantId: string): Promise<ChannelStat[]> {
    const result: { _id: string; count: number }[] =
      await this.sessionModel.aggregate([
        { $match: { merchantId } },
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 },
          },
        },
      ]);

    return result.map((item) => ({
      channel: item._id,
      count: item.count,
    }));
  }
  async topRequestedProducts(merchantId: string, limit = 10): Promise<any[]> {
    const sessions = await this.sessionModel.aggregate([
      { $match: { merchantId } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'customer' } },
      {
        $group: {
          _id: '$messages.text',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return sessions;
  }

  async topCustomerKeywords(
    merchantId: string,
    limit = 20,
  ): Promise<KeywordStat[]> {
    const sessions: { text: string }[] = await this.sessionModel.aggregate([
      { $match: { merchantId } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'customer' } },
      {
        $project: {
          text: '$messages.text',
        },
      },
    ]);

    const stopwords: Set<string> = new Set([
      'ابي',
      'فيه',
      'هل',
      'عندكم',
      'ممكن',
      'ابغى',
      'وش',
      'كم',
      'في',
      'عن',
      'انا',
      'الى',
      'على',
    ]);

    const wordFreq: Record<string, number> = {};

    for (const item of sessions) {
      const words = item.text
        .replace(/[^\u0621-\u064A\s]/g, '') // فقط حروف عربية
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w && !stopwords.has(w));

      for (const word of words) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    }

    const sorted: KeywordStat[] = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));

    return sorted;
  }
}
