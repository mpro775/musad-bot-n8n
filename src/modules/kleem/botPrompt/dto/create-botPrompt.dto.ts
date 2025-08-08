// src/modules/kleem/botPrompt/dto/create-botPrompt.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class CreateBotPromptDto {
  @IsEnum(['system', 'user'])
  type: 'system' | 'user';

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
