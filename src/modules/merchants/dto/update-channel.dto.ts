// src/modules/merchants/dto/update-channel.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WhatsAppConfigDto {
  @ApiPropertyOptional({
    description: 'رقم واتساب المرتبط بالحساب',
    example: '+970599123456',
  })
  @IsString()
  @Matches(/^\+?\d{7,15}$/)
  phone: string;
}

class TelegramConfigDto {
  @ApiPropertyOptional({
    description: 'توكن بوت تيليجرام',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsString()
  token: string;

  @ApiPropertyOptional({
    description: 'معرّف الشات في تيليجرام',
    example: '7730412580',
  })
  @IsString()
  chatId: string;
}

class ChannelConfigDto {
  @ApiPropertyOptional({ type: WhatsAppConfigDto })
  @ValidateNested()
  @Type(() => WhatsAppConfigDto)
  @IsOptional()
  whatsapp?: WhatsAppConfigDto;

  @ApiPropertyOptional({ type: TelegramConfigDto })
  @ValidateNested()
  @Type(() => TelegramConfigDto)
  @IsOptional()
  telegram?: TelegramConfigDto;
}

export class UpdateChannelDto {
  @ApiPropertyOptional({
    description: 'رابط Webhook للبوت (مثلاً /webhooks/telegram)',
    example: 'https://n8n-1-jvkv.onrender.com/webhooks/telegram',
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'رمز API المخصص للتاجر',
    example: 'api_ABC123',
  })
  @IsOptional()
  @IsString()
  apiToken?: string;

  @ApiPropertyOptional({
    description: 'إعدادات القنوات (واتساب وتيليجرام)',
    type: ChannelConfigDto,
  })
  @ValidateNested()
  @Type(() => ChannelConfigDto)
  @IsOptional()
  channelConfig?: ChannelConfigDto;

  @ApiPropertyOptional({
    description: 'فئة النشاط التجاري',
    example: 'إلكترونيات',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({
    description: 'وصف المتجر',
    example: 'نبيع أرقى منتجات الإلكترونيات',
  })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({
    description: 'اللهجة المفضلة للردود',
    example: 'خليجي',
  })
  @IsOptional()
  @IsString()
  preferredDialect?: string;
}
