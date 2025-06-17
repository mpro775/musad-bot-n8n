import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Matches,
  IsUrl,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { PromptConfigDto } from './prompt-config.dto';
import { Type } from 'class-transformer';
import { ChannelsDto } from './update-channel.dto'; // استوردها

export class CreateMerchantDto {
  @ApiPropertyOptional({ description: 'اسم التاجر' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'رقم الجوال' })
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional({ description: 'رقم واتساب' })
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/)
  whatsappNumber?: string;

  @ApiPropertyOptional({ description: 'رابط Webhook للبوت' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'إعدادات القنوات (كل قناة بكائن خاص)' })
  @ValidateNested()
  @Type(() => ChannelsDto)
  @IsOptional()
  channels?: ChannelsDto;

  @ApiPropertyOptional({ description: 'تكوين الردود' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromptConfigDto)
  promptConfig?: PromptConfigDto;

  @ApiPropertyOptional({ description: 'فئة المتجر' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ description: 'رابط المتجر ' })
  @IsOptional()
  @IsString()
  storeurl?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;

  @ApiPropertyOptional({ description: 'وصف المتجر' })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({ description: 'سياسة الإرجاع (اختياري)' })
  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @ApiPropertyOptional({ description: 'سياسة الاستبدال (اختياري)' })
  @IsOptional()
  @IsString()
  exchangePolicy?: string;

  @ApiPropertyOptional({ description: 'الفئات / أقسام المنتجات' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'سياسة الشحن والتوصيل (اختياري)' })
  @IsOptional()
  @IsString()
  shippingPolicy?: string;

  @ApiPropertyOptional({ description: 'اللهجة المفضلة' })
  @IsOptional()
  @IsString()
  preferredDialect?: string;
}
