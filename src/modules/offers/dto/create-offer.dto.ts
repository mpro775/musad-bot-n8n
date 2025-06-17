// src/modules/offers/dto/create-offer.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsDate,
  IsNumber,
  ArrayUnique,
} from 'class-validator';

export enum OfferType {
  PERCENT = 'percent',
  FIXED = 'fixed',
  BOGO = 'bogo',
  COUPON = 'coupon',
  CUSTOM = 'custom',
}

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: OfferType })
  @IsEnum(OfferType)
  type: OfferType;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'منتجات العرض (Product IDs)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({ description: 'تصنيف (category) العرض' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'وصف العرض' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'تاريخ بداية العرض',
    type: String,
    example: new Date().toISOString(),
  })
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: 'تاريخ نهاية العرض',
    type: String,
    example: new Date().toISOString(),
  })
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ description: 'كود الكوبون (اختياري)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'أقصى عدد مرات استخدام العرض' })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;
}
