// src/modules/merchants/dto/preview-prompt.dto.ts

import { Type } from 'class-transformer';
import { QuickConfigDto } from './quick-config.dto';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class PreviewPromptDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => QuickConfigDto)
  quickConfig?: Partial<QuickConfigDto>; // الآن اختياري وجزئي

  @IsBoolean()
  useAdvanced: boolean;

  @IsObject()
  testVars: Record<string, string>;
}
