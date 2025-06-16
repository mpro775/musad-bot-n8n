// src/modules/offers/dto/offer-response.dto.ts
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OfferResponseDto {
  @Expose()
  @ApiProperty({
    description: 'معرّف العرض',
    example: '60f8f0e5e1d3c42f88a7b9a1',
  })
  _id: string;

  @Expose()
  @ApiProperty({
    description: 'معرّف التاجر',
    example: '5f7e1a3b4c9d0e2f1a2b3c4d',
  })
  merchantId: string;

  @Expose()
  @ApiProperty({
    description: 'الرابط الأصلي للعرض',
    example: 'https://example.com/offer/abc',
  })
  originalUrl: string;

  @Expose()
  @ApiProperty({ description: 'عنوان العرض', example: 'خصم 20% على العطور' })
  name: string;

  @Expose()
  @ApiProperty({ description: 'نسبة الخصم', example: 20 })
  price: number;

  @Expose()
  @ApiProperty({ description: 'وصف العرض', example: 'خصم حصري لفترة محدودة' })
  description: string;

  @Expose()
  @ApiProperty({
    description: 'روابط صور العرض',
    example: ['https://.../1.jpg', 'https://.../2.jpg'],
  })
  images: string[];

  @Expose()
  @ApiProperty({ description: 'المنصة التي جلب منها العرض', example: 'Salla' })
  platform: string;

  @Expose()
  @ApiProperty({
    description: 'حالة الخطأ أو قائمة الانتظار',
    example: 'queued',
  })
  errorState: string;

  @Expose()
  @ApiProperty({
    description: 'تاريخ الإنشاء',
    example: '2025-06-09T13:45:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'تاريخ آخر تعديل',
    example: '2025-06-09T14:00:00.000Z',
  })
  updatedAt: Date;

  @Expose()
  @ApiProperty({
    description: 'تاريخ آخر تحديث جزئي',
    example: '2025-06-09T13:55:00.000Z',
    required: false,
  })
  lastFetchedAt?: Date;

  @Expose()
  @ApiProperty({
    description: 'تاريخ آخر تحديث كامل',
    example: '2025-06-09T13:45:00.000Z',
    required: false,
  })
  lastFullScrapedAt?: Date;
}
