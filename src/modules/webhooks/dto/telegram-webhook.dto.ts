// src/modules/webhooks/dto/telegram-webhook.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramWebhookDto {
  @ApiProperty()
  @IsString()
  readonly messageId: string;

  @ApiProperty()
  @IsString()
  readonly chatId: string;

  @ApiProperty()
  @IsString()
  readonly text: string;

  // أضف الحقول التي تعتمد عليها في المعالجة
}
