import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MessageSession,
  MessageSessionDocument,
} from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(MessageSession.name)
    private readonly messageModel: Model<MessageSessionDocument>,
  ) {}

  // إنشاء أو تحديث جلسة برسائل جديدة
  async createOrAppend(dto: CreateMessageDto): Promise<MessageSession> {
    const existing = await this.messageModel.findOne({
      merchantId: dto.merchantId,
      sessionId: dto.sessionId,
    });

    const timestampedMessages = dto.messages.map((m) => ({
      ...m,
      timestamp: new Date(),
    }));

    if (existing) {
      existing.messages.push(...timestampedMessages);
      existing.markModified('messages');
      return existing.save();
    } else {
      return this.messageModel.create({
        merchantId: dto.merchantId,
        sessionId: dto.sessionId,
        channel: dto.channel,
        messages: timestampedMessages,
      });
    }
  }

  // جلب الجلسة كاملة حسب sessionId
  async findBySession(sessionId: string): Promise<MessageSession | null> {
    return this.messageModel.findOne({ sessionId }).exec();
  }

  // جلب جلسة واحدة حسب المعرف
  async findById(id: string): Promise<MessageSessionDocument> {
    const doc = await this.messageModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Message session with id ${id} not found`);
    }
    return doc;
  }

  // تحديث بيانات الجلسة أو أحد الحقول (مثل tags أو notes)
  async update(
    id: string,
    dto: UpdateMessageDto,
  ): Promise<MessageSessionDocument> {
    const updated = await this.messageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Message session with id ${id} not found`);
    }
    return updated;
  }

  // حذف جلسة كاملة
  async remove(id: string): Promise<{ deleted: boolean }> {
    const res = await this.messageModel.deleteOne({ _id: id }).exec();
    return { deleted: res.deletedCount > 0 };
  }

  // جلب عدة جلسات مع فلترة حسب التاجر أو القناة
  async findAll(filters: {
    merchantId?: string;
    channel?: string;
    limit: number;
    page: number;
  }): Promise<{ data: MessageSession[]; total: number }> {
    const query: any = {};
    if (filters.merchantId) query.merchantId = filters.merchantId;
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
