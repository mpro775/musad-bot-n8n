// src/chat/chat.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatWidgetService } from './chat-widget.service';
import { ChatWidgetController } from './chat-widget.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChatWidgetSettings,
  ChatWidgetSettingsSchema,
} from './schema/chat-widget.schema';
import { MerchantsModule } from '../merchants/merchants.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatWidgetSettings.name, schema: ChatWidgetSettingsSchema },
    ]),
    forwardRef(() => MerchantsModule),

    HttpModule,
  ],
  providers: [ChatGateway, ChatWidgetService],
  controllers: [ChatWidgetController],
  exports: [ChatWidgetService, ChatGateway],
})
export class ChatModule {}
