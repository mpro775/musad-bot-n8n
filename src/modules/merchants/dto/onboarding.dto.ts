// src/modules/auth/dto/onboarding.dto.ts
import {
  IsString,
  IsOptional,
  IsUrl,
  Matches,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardingDto {
  @ApiProperty({ description: 'اسم المتجر', example: 'متجر مفيد' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'فئة النشاط التجاري',
    example: 'إلكترونيات',
    enum: ['إلكترونيات', 'موضة', 'طعام', 'خدمات', 'أخرى'],
  })
  @IsString()
  @IsIn(['إلكترونيات', 'هواتف ومستلزماتة', 'موضة', 'طعام', 'خدمات', 'أخرى'])
  businessType: string;

  @ApiProperty({
    description: 'وصف قصير للمتجر (2–3 أسطر)',
    example: 'نقدم منتجات عضوية 100% بتغليف فاخر',
  })
  @IsString()
  @MaxLength(200)
  businessDescription: string;

  @ApiPropertyOptional({
    description: 'رابط المتجر (اختياري)',
    example: 'https://mystore.example.com',
  })
  @IsOptional()
  @IsUrl()
  storeurl?: string;
  @ApiProperty({ description: 'رقم الجوال الرسمي', example: '+970599123456' })
  @Matches(/^\+?\d{7,15}$/)
  phone: string;

  @ApiPropertyOptional({
    description: 'رقم واتساب (اختياري)',
    example: '+970599123456',
  })
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/)
  whatsappNumber?: string;

  @ApiProperty({
    description: 'رابط Webhook للبوت',
    example: 'https://…/webhook',
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiProperty({
    description: 'رابط Webhook للبوت',
    example: 'https://…/webhook',
  })
  @ApiPropertyOptional({
    description: 'توكن بوت التليجرام (اختياري)',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsOptional()
  @IsString()
  telegramToken?: string;

  @ApiPropertyOptional({
    description: 'معرّف الشات في التليجرام (اختياري)',
    example: '-1001234567890',
  })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiPropertyOptional({
    description: 'اللهجة المفضّلة للرد (Prompt)',
    example: 'خليجي',
    enum: ['خليجي', 'مصري', 'شامي', 'سعودي', 'أخرى'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['خليجي', 'مصري', 'شامي', 'سعودي', 'أخرى'])
  preferredDialect?: string;

  @ApiPropertyOptional({
    description: 'نغمة الردّ (رسمي|ودّي|طريف)',
    example: 'ودّي',
    enum: ['رسمي', 'ودّي', 'طريف'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['رسمي', 'ودّي', 'طريف'])
  tone?: string;

  @ApiPropertyOptional({
    description: 'قالب مخصّص للـ Prompt (اختياري)',
    example: 'إذا سأل العميل عن سعر المنتج، أجب بـ…',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  template?: string;

  @ApiPropertyOptional({
    description: 'رمز API مخصّص للتاجر (اختياري)',
    example: 'api_ABC123',
  })
  @IsOptional()
  @IsString()
  apiToken?: string;
}
