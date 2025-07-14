// ---------------------------
// File: src/modules/messaging/message.service.ts
// ---------------------------
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MessageSession,
  MessageSessionDocument,
} from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { removeStopwords } from 'stopword';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(MessageSession.name)
    private readonly messageModel: Model<MessageSessionDocument>,
  ) {}

  async createOrAppend(dto: CreateMessageDto): Promise<MessageSessionDocument> {
    const mId = new Types.ObjectId(dto.merchantId);
    const existing = await this.messageModel.findOne({
      merchantId: mId,
      sessionId: dto.sessionId,
      channel: dto.channel,
    });

    // حول كل عنصر في dto.messages ليشمل الكلمات المفتاحية والتوقيت
    const toInsert = dto.messages.map((m) => {
      // استخراج الكلمات المفتاحية من نص كل رسالة
      const tokens = m.text.toLowerCase().match(/\b[\p{L}0-9]+\b/gu) || [];
      const keywords = removeStopwords(tokens);

      return {
        role: m.role,
        text: m.text,
        metadata: m.metadata || {},
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        keywords,
      };
    });

    if (existing) {
      existing.messages.push(...toInsert);
      existing.markModified('messages');
      return existing.save();
    } else {
      return this.messageModel.create({
        merchantId: mId,
        sessionId: dto.sessionId,
        channel: dto.channel,
        messages: toInsert,
      });
    }
  }

  async findBySession(
    sessionId: string,
  ): Promise<MessageSessionDocument | null> {
    return this.messageModel.findOne({ sessionId }).exec();
  }

  async findById(id: string): Promise<MessageSessionDocument> {
    const doc = await this.messageModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Session ${id} not found`);
    return doc;
  }
  async setHandover(sessionId: string, handoverToAgent: boolean) {
    return this.messageModel.updateOne({ sessionId }, { handoverToAgent });
  }

  async update(
    id: string,
    dto: UpdateMessageDto,
  ): Promise<MessageSessionDocument> {
    const updated = await this.messageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Session ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const res = await this.messageModel.deleteOne({ _id: id }).exec();
    return { deleted: res.deletedCount > 0 };
  }

  async findAll(filters: {
    merchantId?: string;
    channel?: string;
    limit: number;
    page: number;
  }): Promise<{ data: MessageSessionDocument[]; total: number }> {
    const query: any = {};
    if (filters.merchantId)
      query.merchantId = new Types.ObjectId(filters.merchantId);
    if (filters.channel) query.channel = filters.channel;

    const total = await this.messageModel.countDocuments(query);
    const data = await this.messageModel
      .find(query)
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .sort({ updatedAt: -1 })
      .exec();

    return { data, total };
  }
}
