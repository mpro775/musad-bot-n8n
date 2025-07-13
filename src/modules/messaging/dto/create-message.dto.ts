// src/modules/messaging/dto/create-message.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class MessageItemDto {
  @IsString()
  @IsNotEmpty()
  role: 'customer' | 'bot' | 'agent';

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  timestamp?: Date; // سيُملأ تلقائياً إذا لم يُرسل
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageItemDto)
  messages: MessageItemDto[];
}
