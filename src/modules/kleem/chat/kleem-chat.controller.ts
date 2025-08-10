// src/modules/kleem/chat/kleem-chat.controller.ts
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { KleemChatService } from './kleem-chat.service';
import { BotChatsService } from '../botChats/botChats.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('kleem/chat')
@UseGuards(JwtAuthGuard)
export class KleemChatController {
  constructor(
    private readonly kleem: KleemChatService,
    private readonly chats: BotChatsService,
  ) {}

  @Post(':sessionId/message')
  @Public()
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { text: string; metadata?: Record<string, unknown> },
  ) {
    return this.kleem.handleUserMessage(sessionId, body.text, body.metadata);
  }

  @Post(':sessionId/rate')
  @Public()
  async rate(
    @Param('sessionId') sessionId: string,
    @Body() body: { msgIdx: number; rating: 0 | 1; feedback?: string },
  ) {
    return this.chats.rateMessage(
      sessionId,
      body.msgIdx,
      body.rating,
      body.feedback,
    );
  }

  @Get(':sessionId') // للـ polling من الواجهة
  @Public()
  async getSession(@Param('sessionId') sessionId: string) {
    return this.chats.findBySession(sessionId);
  }
}
