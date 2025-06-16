// src/modules/products/dto/product-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ description: 'المعرف الفريد للمنتج' })
  _id: string;

  @ApiProperty({ description: 'معرف التاجر مالك المنتج' })
  merchantId: string;

  @ApiProperty({ description: 'الرابط الأصلي للمنتج' })
  originalUrl: string;

  // الحقول الجديدة
  @ApiProperty({ description: 'اسم المنصة المصدر', example: 'zid' })
  platform: string;

  @ApiProperty({ description: 'اسم المنتج', example: '' })
  name: string;

  @ApiProperty({ description: 'السعر', example: 0 })
  price: number;

  @ApiProperty({ description: 'هل المنتج متوفر؟', example: true })
  isAvailable: boolean;

  @ApiProperty({ description: 'وصف المنتج', example: '' })
  description: string;

  @ApiProperty({ description: 'الصور', type: [String] })
  images: string[];

  @ApiProperty({ description: 'فئة المنتج', example: '' })
  category: string;

  @ApiProperty({ description: 'حالة التوفر المنخفض', example: '' })
  lowQuantity: string;

  @ApiProperty({ description: 'المواصفات الإضافية', type: [String] })
  specsBlock: string[];

  @ApiProperty({ description: 'الكلمات المفتاحية', type: [String] })
  keywords: string[];

  @ApiProperty({
    description: 'آخر تحديث جزئي (minimal)',
    type: String,
    format: 'date-time',
  })
  lastFetchedAt: Date;

  @ApiProperty({
    description: 'آخر تحديث شامل (full)',
    type: String,
    format: 'date-time',
  })
  lastFullScrapedAt: Date;

  @ApiProperty({
    description: 'حالة الخطأ عند السكريبينج إن وجدت',
    example: null,
    required: false,
  })
  errorState?: string;
}
