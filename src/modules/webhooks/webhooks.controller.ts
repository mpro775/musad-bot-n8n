import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { HandleWebhookDto } from './dto/handle-webhook.dto';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TrialGuard } from 'src/common/guards/trial.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BotReplyDto } from './dto/bot-reply.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':eventType/:merchantId')
  @ApiOperation({
    summary: 'Handle generic webhook events (e.g., incoming messages).',
  })
  @ApiParam({
    name: 'eventType',
    type: String,
    description: 'نوع الحدث (مثلاً telegram_incoming)',
  })
  @ApiParam({
    name: 'merchantId',
    type: String,
    description: 'معرف التاجر في قاعدة البيانات',
  })
  @ApiBody({
    type: HandleWebhookDto,
    description: 'Payload for the webhook event.',
  })
  @ApiCreatedResponse({
    description: 'تمت المعالجة بنجاح وارجاع conversationId.',
  })
  @ApiBadRequestResponse({ description: 'الحمولة ناقصة أو غير صحيحة.' })
  @HttpCode(HttpStatus.CREATED)
  async handleWebhook(
    @Param('eventType') eventType: string,
    @Param('merchantId') merchantId: string,
    @Body() dto: HandleWebhookDto,
  ) {
    const { from, messageText, metadata } = dto.payload || {};
    if (!from || !messageText) {
      throw new BadRequestException('الحقول from وmessageText مطلوبة.');
    }

    // نمرّر merchantId من العنوان بدل الاعتماد على payload
    return this.webhooksService.handleEvent(eventType, {
      merchantId,
      from,
      messageText,
      metadata,
    });
  }
  @Post('reply/:merchantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استقبال ردود البوت من n8n وتخزينها' })
  @ApiParam({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiBody({ type: BotReplyDto })
  @ApiOkResponse({ description: 'تم تسجيل رد البوت بنجاح' })
  @UseGuards(JwtAuthGuard, TrialGuard)
  async receiveBotReply(
    @Param('merchantId') merchantId: string,
    @Body() dto: BotReplyDto,
  ) {
    return this.webhooksService.handleBotReply(merchantId, dto);
  }
}
