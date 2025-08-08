// src/modules/kleem/botPrompt/dto/set-active.dto.ts
import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @IsBoolean()
  active: boolean;
}
