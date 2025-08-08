// src/modules/kleem/botFaq/dto/create-botFaq.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class CreateBotFaqDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;

  @IsOptional()
  @IsString()
  source?: 'manual' | 'auto' | 'imported';
}
