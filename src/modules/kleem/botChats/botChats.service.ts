// src/modules/kleem/botChats/botChats.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { BotChatSession } from './schemas/botChats.schema';

export interface AppendMessage {
  role: 'user' | 'bot';
  text: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

@Injectable()
export class BotChatsService {
  constructor(
    @InjectModel(BotChatSession.name)
    private readonly botChatModel: Model<BotChatSession>,
  ) {}

  async createOrAppend(sessionId: string, messages: AppendMessage[]) {
    const doc = await this.botChatModel.findOne({ sessionId });
    const toInsert = messages.map((m) => ({
      role: m.role,
      text: m.text,
      metadata: m.metadata ?? {},
      timestamp: m.timestamp ?? new Date(),
    }));

    if (doc) {
      doc.messages.push(...toInsert);
      doc.markModified('messages');
      return doc.save();
    }
    return this.botChatModel.create({ sessionId, messages: toInsert });
  }

  async rateMessage(
    sessionId: string,
    msgIdx: number,
    rating: 0 | 1,
    feedback?: string,
  ) {
    const doc = await this.botChatModel.findOne({ sessionId });
    if (!doc || !doc.messages[msgIdx]) {
      throw new Error('Message not found for rating');
    }
    doc.messages[msgIdx].rating = rating;
    if (typeof feedback === 'string') doc.messages[msgIdx].feedback = feedback;
    await doc.save();
    return { status: 'ok' as const };
  }

  async findBySession(sessionId: string) {
    return this.botChatModel.findOne({ sessionId }).lean();
  }

  async findAll(page = 1, limit = 20, q?: string) {
    const filter: FilterQuery<BotChatSession> = {};
    if (q) (filter as any)['messages.text'] = { $regex: q, $options: 'i' };

    const total = await this.botChatModel.countDocuments(filter);
    const data = await this.botChatModel
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ updatedAt: -1 })
      .lean();

    return { data, total };
  }

  // إحصائيات
  async getTopQuestions(limit = 10) {
    const agg = await this.botChatModel.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'user' } },
      { $group: { _id: '$messages.text', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return agg.map((x) => ({
      question: x._id as string,
      count: x.count as number,
    }));
  }

  async getFrequentBadBotReplies(limit = 10) {
    const agg = await this.botChatModel.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'bot', 'messages.rating': 0 } },
      {
        $group: {
          _id: '$messages.text',
          count: { $sum: 1 },
          feedbacks: { $push: '$messages.feedback' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return agg.map((x) => ({
      text: x._id as string,
      count: x.count as number,
      feedbacks: (x.feedbacks as (string | null)[]).filter(Boolean) as string[],
    }));
  }
}
