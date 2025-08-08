// src/modules/kleem/botPrompt/dto/update-botPrompt.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBotPromptDto } from './create-botPrompt.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBotPromptDto extends PartialType(CreateBotPromptDto) {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
