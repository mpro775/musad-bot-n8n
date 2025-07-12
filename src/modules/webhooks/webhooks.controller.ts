// ---------------------------
// File: src/modules/webhooks/webhooks.controller.ts
// ---------------------------
import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { MessageService } from '../messaging/message.service';
import { CreateMessageDto } from '../messaging/dto/create-message.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly messageService: MessageService) {}

  @Post('incoming/:merchantId')
  async handleIncoming(
    @Param('merchantId') merchantId: string,
    @Body() body: any,
  ) {
    const { from, text, metadata, channel } = body;
    if (!merchantId || !from || !text || !channel) {
      throw new BadRequestException('Payload missing required fields');
    }

    const dto: CreateMessageDto = {
      merchantId,
      sessionId: from,
      channel,
      messages: [
        {
          role: 'customer',
          text,
          metadata: metadata || {},
        },
      ],
    };

    await this.messageService.createOrAppend(dto);
    return { sessionId: from };
  }

  @Post('bot-reply/:merchantId')
  async handleBotReply(
    @Param('merchantId') merchantId: string,
    @Body() body: any,
  ) {
    const { sessionId, text, metadata, channel } = body;
    if (!merchantId || !sessionId || !text || !channel) {
      throw new BadRequestException('Payload missing required fields');
    }

    const dto: CreateMessageDto = {
      merchantId,
      sessionId,
      channel,
      messages: [
        {
          role: 'bot',
          text,
          metadata: metadata || {},
        },
      ],
    };

    await this.messageService.createOrAppend(dto);
    return { sessionId };
  }
}
