import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class SemanticRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  merchantId: string; // ← ضيف هذا الحقل

  @IsOptional()
  @IsNumber()
  topK?: number;
}
