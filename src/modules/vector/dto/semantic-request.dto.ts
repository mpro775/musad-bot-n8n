import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class SemanticRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsOptional()
  @Type(() => Number) // ← هذا يحل المشكلة
  @IsNumber()
  topK?: number;
}
