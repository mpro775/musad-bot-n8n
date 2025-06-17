// src/modules/products/dto/update-product.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDate,
  ValidateIf,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductSource } from './create-product.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'اسم المنتج' })
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional({
    description: 'مصدر المنتج (لا يمكن تغييره بعد الإنشاء)',
    enum: ProductSource,
  })
  @ApiPropertyOptional({ description: 'مصدر المنتج', enum: ProductSource })
  @IsEnum(ProductSource)
  source: ProductSource;
  @ApiPropertyOptional({
    description: 'رابط المنتج أو API URL',
    example: 'https://...',
  })
  @ValidateIf(
    (o) => o.source === ProductSource.API || o.source === ProductSource.SCRAPER,
  )
  @IsUrl()
  sourceUrl?: string;
  @ApiPropertyOptional({
    description: 'معرّف المنتج في API خارجي',
    example: '12345',
  })
  @ValidateIf((o) => o.source === ProductSource.API)
  @IsString()
  externalId?: string;
  @ApiPropertyOptional({
    description: 'حالة المنتج',
    enum: ['active', 'inactive', 'out_of_stock'],
  })
  @IsEnum(['active', 'inactive', 'out_of_stock'])
  status?: 'active' | 'inactive' | 'out_of_stock';

  @ApiPropertyOptional({ description: 'تاريخ آخر مزامنة' })
  @IsDate()
  lastSync?: Date;
  @ApiPropertyOptional({ description: 'السعر' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'توفر المنتج' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'الكلمات المفتاحية' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ description: 'حالة خطأ أو ملاحظة حول المنتج' })
  @IsOptional()
  @IsString()
  errorState?: string;

  @ApiPropertyOptional({ description: 'الصور' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'المنصة' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'الوصف' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'التصنيف' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'الكمية المنخفضة' })
  @IsOptional()
  @IsString()
  lowQuantity?: string;

  @ApiPropertyOptional({ description: 'مواصفات المنتج' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specsBlock?: string[];

  @ApiPropertyOptional({ description: 'آخر تحديث للمنتج', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastFetchedAt?: Date;

  @ApiPropertyOptional({ description: 'آخر جلب كامل للبيانات', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastFullScrapedAt?: Date;
}
