// src/modules/offers/dto/create-offer.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({
    description: 'رابط العرض الأصلي',
    example: 'https://example.com/offer/abc',
  })
  @IsString()
  @IsNotEmpty()
  originalUrl: string;

  @ApiPropertyOptional({
    description: 'عنوان العرض',
    example: 'خصم 20% على العطور',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'نسبة الخصم', example: 20 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({
    description: 'وصف العرض',
    example: 'خصم حصري لفترة محدودة',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'روابط الصور',
    example: ['https://…/1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'المنصة المصدر', example: 'Salla' })
  @IsOptional()
  @IsString()
  platform?: string;
}
