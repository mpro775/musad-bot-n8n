// src/modules/webhooks/webhooks.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Webhook, WebhookDocument } from './schemas/webhook.schema';
import { MessageService } from '../messaging/message.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly messageService: MessageService,
    @InjectModel(Webhook.name)
    private readonly webhookModel: Model<WebhookDocument>,
  ) {}

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
}
