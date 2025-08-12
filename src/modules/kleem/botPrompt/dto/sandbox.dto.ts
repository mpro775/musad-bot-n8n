import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class SandboxDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsBoolean()
  attachKnowledge?: boolean; // افتراضي true

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  topK?: number; // افتراضي 5

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean; // true = معاينة فقط بدون استدعاء LLM
}
