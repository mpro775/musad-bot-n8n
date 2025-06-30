import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SemanticRequestDto {
  @ApiProperty({ description: 'النص المطلوب البحث عنه' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'معرّف التاجر' })
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @ApiPropertyOptional({ description: 'عدد النتائج المطلوبة', default: 5 })
  @IsOptional()
  @Type(() => Number) // ← هذا يحل المشكلة
  @IsNumber()
  topK?: number;
}
