// src/modules/merchants/dto/preview-prompt.dto.ts

import { Type } from 'class-transformer';
import { QuickConfigDto } from './quick-config.dto';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class PreviewPromptDto {
  @ApiPropertyOptional({ type: QuickConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuickConfigDto)
  quickConfig?: Partial<QuickConfigDto>; // الآن اختياري وجزئي

  @ApiProperty()
  @IsBoolean()
  useAdvanced: boolean;

  @ApiProperty({ type: Object })
  @IsObject()
  testVars: Record<string, string>;
}
