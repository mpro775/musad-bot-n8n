// src/modules/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { Webhook, WebhookSchema } from './schemas/webhook.schema';

import { MessagingModule } from '../messaging/message.module';
import { OrdersModule } from '../orders/orders.module';
import { Merchant, MerchantSchema } from '../merchants/schemas/merchant.schema';
import { ChatMediaModule } from '../media/chat-media.module';

@Module({
  imports: [
    // فقط موديل Webhook لتخزين الأحداث الواردة
    MongooseModule.forFeature([{ name: Webhook.name, schema: WebhookSchema }]),
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
    OrdersModule,
    ChatMediaModule,
    // وحدات الاعتمادية
    MessagingModule, // لحفظ الرسائل (MessageService)
  ],
  providers: [
    WebhooksService, // خدمة معالجة الـ webhook العامة
  ],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
