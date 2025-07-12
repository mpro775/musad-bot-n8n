// src/modules/webhooks/webhooks.service.ts
import {
  Injectable,
  BadRequestException,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Webhook, WebhookDocument } from './schemas/webhook.schema';
import { MessageService } from '../messaging/message.service';
import { BotReplyDto } from './dto/bot-reply.dto';
import { ConversationDto } from './dto/conversation.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly messageService: MessageService,
    @InjectModel(Webhook.name)
    private readonly webhookModel: Model<WebhookDocument>,
  ) {}

  // في نهاية Workflow: أرسل كل الرسائل دفعة واحدة
  @Post('conversation/:merchantId')
  async handleConversation(
    @Param('merchantId') merchantId: string,
    @Body() dto: ConversationDto,
  ) {
    const { sessionId, channel, messages } = dto;
    if (!merchantId || !sessionId || !channel || !messages?.length) {
      throw new BadRequestException('Missing conversation fields');
    }

    // حضّر المُدخلات مع timestamp افتراضي
    const timestamped = messages.map((m) => ({
      role: m.role,
      text: m.text,
      metadata: m.metadata || {},
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));

    // استدعي الخدمة لتخزين الجلسة كاملة (إنشاؤها أو الإلحاق)
    const session = await this.messageService.createOrAppend({
      merchantId,
      sessionId,
      channel,
      messages: timestamped,
    });

    return { sessionId: session.sessionId, storedMessages: timestamped.length };
  }
  async handleEvent(eventType: string, payload: any) {
    const { merchantId, from, messageText, metadata } = payload;

    if (!merchantId || !from || !messageText) {
      throw new BadRequestException(`Invalid payload for ${eventType}`);
    }

    const channel = eventType.replace('_incoming', '');

    // 1. تخزين الحدث الخام
    await this.webhookModel.create({
      eventType,
      payload: JSON.stringify(payload),
      receivedAt: new Date(),
    });

    // 2. إنشاء أو تحديث الجلسة وتخزين الرسالة
    await this.messageService.createOrAppend({
      merchantId,
      sessionId: from, // الهاتف كمفتاح الجلسة
      channel,
      messages: [
        {
          role: 'customer',
          text: messageText,
          metadata: metadata || {},
        },
      ],
    });

    // 3. إعادة sessionId لاستخدامه في n8n (بدلًا من conversationId)
    return { sessionId: from };
  }
  async handleBotReply(
    merchantId: string,
    dto: BotReplyDto,
  ): Promise<{ sessionId: string }> {
    const { sessionId, text, metadata } = dto;
    if (!sessionId || !text) {
      throw new BadRequestException('sessionId و text مطلوبة');
    }

    // نحفظ رسالة البوت
    await this.messageService.createOrAppend({
      merchantId,
      sessionId,
      channel: 'webchat', // أو القناة المناسبة
      messages: [
        {
          role: 'bot',
          text,
          metadata: metadata || {},
        },
      ],
    });

    return { sessionId };
  }
}
