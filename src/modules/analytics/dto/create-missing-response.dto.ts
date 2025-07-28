// src/analytics/dto/create-missing-response.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMissingResponseDto {
  @IsString()
  merchant: string;

  @IsString()
  channel: 'telegram' | 'whatsapp' | 'webchat';

  @IsString()
  question: string;

  @IsString()
  botReply: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  aiAnalysis?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  type: 'missing_response' | 'unavailable_product';

  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}
