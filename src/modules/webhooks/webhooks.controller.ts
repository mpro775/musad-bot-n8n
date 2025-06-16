import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
} from '@nestjs/swagger';

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
}
