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
    example: 'bot',
  })
  @IsEnum(['customer', 'bot'])
  role: 'customer' | 'bot';

  @ApiProperty({
    description: 'نص الرسالة',
    example: 'تم تحديث الرد بناءً على توفر المنتج.',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'بيانات إضافية (اختياري)',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateMessageDto {
  @ApiProperty({
    description: 'تعديل القناة (اختياري)',
    example: 'telegram',
    enum: ['whatsapp', 'telegram', 'webchat'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['whatsapp', 'telegram', 'webchat'])
  channel?: string;

  @ApiProperty({
    description: 'تعديل أو استبدال metadata للجلسة بالكامل (اختياري)',
    type: Object,
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'استبدال كامل لمصفوفة الرسائل (اختياري وخطير)',
    type: [MessageContentDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MessageContentDto)
  messages?: MessageContentDto[];
}
