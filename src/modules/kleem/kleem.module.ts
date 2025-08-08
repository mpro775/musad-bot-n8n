// src/modules/kleem/kleem.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KleemGateway } from './ws/kleem.gateway';
import { KleemChatService } from './chat/kleem-chat.service';
import { BotChatsModule } from './botChats/botChats.module';
import { BotFaqModule } from './botFaq/botFaq.module';
import { KleemWebhookController } from './webhook/kleem-webhook.controller';

@Module({
  imports: [EventEmitterModule.forRoot(), BotChatsModule, BotFaqModule],
  providers: [KleemGateway, KleemChatService],
  controllers: [KleemWebhookController],
  exports: [KleemChatService],
})
export class KleemModule {}
