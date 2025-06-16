// src/modules/products/dto/create-product.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'الرابط الأصلي للمنتج (من المتجر)',
    example: 'https://example.com/product/123',
  })
  @IsString()
  @IsNotEmpty()
  originalUrl: string;

  @ApiPropertyOptional({ description: 'اسم المنتج', example: 'عطر فاخر' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'سعر المنتج', example: 150.75 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'هل المنتج متوفر؟', example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'كلمات مفتاحية مرتبطة بالمنتج',
    example: ['عطر', 'فرنسي', 'فاخر'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    description: 'المنصة التي تم جلب المنتج منها',
    example: 'Salla',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    description: 'وصف المنتج',
    example: 'عطر رجالي بعبق العود والمسك.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'روابط الصور الخاصة بالمنتج',
    example: ['https://img.com/1.jpg', 'https://img.com/2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'تصنيف المنتج',
    example: 'العطور الشرقية',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'الكمية المنخفضة التي تنذر بالنفاد',
    example: '5',
  })
  @IsOptional()
  @IsString()
  lowQuantity?: string;

  @ApiPropertyOptional({
    description: 'مواصفات المنتج بتنسيق نصوص',
    example: ['الحجم: 100ml', 'النوع: بخاخ'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specsBlock?: string[];

  @ApiPropertyOptional({
    description: 'تاريخ آخر تحديث جزئي للمنتج',
    example: new Date().toISOString(),
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastFetchedAt?: Date;

  @ApiPropertyOptional({
    description: 'تاريخ آخر تحديث كامل للمنتج',
    example: new Date().toISOString(),
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastFullScrapedAt?: Date;
}
