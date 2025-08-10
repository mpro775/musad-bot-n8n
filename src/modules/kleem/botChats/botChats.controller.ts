// src/modules/kleem/botChats/botChats.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { BotChatsService } from './botChats.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';

@Controller('admin/kleem/bot-chats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BotChatsController {
  constructor(private readonly svc: BotChatsService) {}

  @Post(':sessionId')
  async saveMessage(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      messages: {
        role: 'user' | 'bot';
        text: string;
        metadata?: Record<string, unknown>;
      }[];
    },
  ) {
    return this.svc.createOrAppend(sessionId, body.messages);
  }

  @Patch(':sessionId/rate/:msgIdx')
  async rateMessage(
    @Param('sessionId') sessionId: string,
    @Param('msgIdx') msgIdx: string,
    @Body() body: { rating: 0 | 1; feedback?: string },
  ) {
    return this.svc.rateMessage(
      sessionId,
      Number(msgIdx),
      body.rating,
      body.feedback,
    );
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.svc.findBySession(sessionId);
  }

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.findAll(Number(page) || 1, Number(limit) || 20, q);
  }

  // إحصائيات
  @Get('stats/top-questions/list')
  async topQuestions(@Query('limit') limit?: string) {
    return this.svc.getTopQuestions(Number(limit) || 10);
  }

  @Get('stats/bad-bot-replies/list')
  async badReplies(@Query('limit') limit?: string) {
    return this.svc.getFrequentBadBotReplies(Number(limit) || 10);
  }
}
