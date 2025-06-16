import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class MessageContentDto {
  @ApiProperty({
    description: 'دور المرسل',
    enum: ['customer', 'bot'],
    example: 'customer',
  })
  @IsEnum(['customer', 'bot'])
  role: 'customer' | 'bot';

  @ApiProperty({
    description: 'نص الرسالة',
    example: 'مرحبًا! أبغى شاحن سامسونج.',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'بيانات إضافية للرسالة (اختياري)',
    type: Object,
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateMessageDto {
  @ApiProperty({ description: 'معرّف التاجر', example: '6631ee7f...' })
  @IsString()
  merchantId: string;

  @ApiProperty({
    description: 'معرف الجلسة (رقم جوال أو sessionId موحد)',
    example: '966501234567',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'القناة المستخدمة',
    enum: ['whatsapp', 'telegram', 'webchat'],
    example: 'whatsapp',
  })
  @IsEnum(['whatsapp', 'telegram', 'webchat'])
  channel: string;

  @ApiProperty({
    description: 'مصفوفة الرسائل المُراد إضافتها إلى الجلسة',
    type: [MessageContentDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MessageContentDto)
  messages: MessageContentDto[];
}
