// src/modules/kleem/webhook/kleem-webhook.controller.ts

import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { BotChatsService } from '../botChats/botChats.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KleemWsMessage } from '../ws/kleem-ws.types';

@Controller('webhooks/kleem')
export class KleemWebhookController {
  constructor(
    private readonly chatsSvc: BotChatsService,
    private readonly events: EventEmitter2,
  ) {}

  // استقبال رسالة جديدة من صفحة الهبوط (Landing WebChat)
  @Post('conversation/:sessionId')
  async handleKleemConversation(
    @Param('sessionId') sessionId: string,
    @Body() body: { messages: any[] },
  ) {
    return this.chatsSvc.createOrAppend(sessionId, body.messages);
  }
  @Post('bot-reply/:sessionId')
  async botReply(
    @Param('sessionId') sessionId: string,
    @Body() body: { text?: string; metadata?: Record<string, unknown> },
  ) {
    const text = body?.text ?? '';
    if (!sessionId || !text) {
      throw new BadRequestException('sessionId and text are required');
    }

    const saved = await this.chatsSvc.createOrAppend(sessionId, [
      { role: 'bot', text, metadata: body.metadata ?? {} },
    ]);
    const msgIdx = saved.messages.length - 1;

    const wsMsg: KleemWsMessage = { role: 'bot', text, msgIdx };
    this.events.emit('kleem.bot_reply', { sessionId, message: wsMsg });
    this.events.emit('kleem.admin_new_message', { sessionId, message: wsMsg });

    return { sessionId, msgIdx };
  }
  // بإمكانك إضافة Webhook للردود أيضًا...
}
