import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WhatsAppChannelDto {
  @ApiPropertyOptional({
    description: 'رقم واتساب المرتبط بالحساب',
    example: '+970599123456',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/)
  phone?: string;

  @ApiPropertyOptional({
    description: 'توكن واتساب السحابي',
    example: 'EAA...',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'معرّف رقم واتساب السحابي',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @ApiPropertyOptional({ description: 'هل القناة مفعّلة؟', example: true })
  @IsOptional()
  enabled?: boolean;
}

class TelegramChannelDto {
  @ApiPropertyOptional({
    description: 'توكن بوت تيليجرام',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsOptional()
  @IsString()
  botToken?: string;

  @ApiPropertyOptional({
    description: 'معرّف الشات في تيليجرام',
    example: '7730412580',
  })
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional({ description: 'هل القناة مفعّلة؟', example: true })
  @IsOptional()
  enabled?: boolean;
}

class WebchatChannelDto {
  @ApiPropertyOptional({ description: 'هل القناة مفعّلة؟', example: true })
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'إعدادات الويب شات', type: Object })
  @IsOptional()
  widgetSettings?: Record<string, any>;
}

export class ChannelsDto {
  @ApiPropertyOptional({ type: WhatsAppChannelDto })
  @ValidateNested()
  @Type(() => WhatsAppChannelDto)
  @IsOptional()
  whatsapp?: WhatsAppChannelDto;

  @ApiPropertyOptional({ type: TelegramChannelDto })
  @ValidateNested()
  @Type(() => TelegramChannelDto)
  @IsOptional()
  telegram?: TelegramChannelDto;

  @ApiPropertyOptional({ type: WebchatChannelDto })
  @ValidateNested()
  @Type(() => WebchatChannelDto)
  @IsOptional()
  webchat?: WebchatChannelDto;
  // أضف قنوات أخرى بنفس النمط
}

export class UpdateChannelDto {
  @ApiPropertyOptional({
    description: 'رابط Webhook للبوت',
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
    description: 'إعدادات القنوات (كل قناة بكائن خاص)',
    type: ChannelsDto,
  })
  @ValidateNested()
  @Type(() => ChannelsDto)
  @IsOptional()
  channels?: ChannelsDto;

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
