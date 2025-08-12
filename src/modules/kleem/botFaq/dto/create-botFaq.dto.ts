// src/modules/kleem/botFaq/dto/create-botFaq.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
  IsIn,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBotFaqDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  question: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(3000)
  answer: string;

  @IsOptional()
  @IsEnum(['manual', 'auto', 'imported'])
  source?: 'manual' | 'auto' | 'imported';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';
}
