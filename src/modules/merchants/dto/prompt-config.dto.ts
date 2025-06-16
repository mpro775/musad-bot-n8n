// src/modules/merchants/dto/prompt-config.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class PromptConfigDto {
  @ApiPropertyOptional({
    description: 'اللهجة',
    example: 'خليجي',
    enum: ['خليجي', 'مصري', 'شامي', 'سعودي', 'أخرى'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['خليجي', 'مصري', 'شامي', 'سعودي', 'أخرى'])
  dialect?: string;

  @ApiPropertyOptional({
    description: 'نغمة الرد',
    example: 'ودّي',
    enum: ['رسمي', 'ودّي', 'طريف'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['رسمي', 'ودّي', 'طريف'])
  tone?: string;

  @ApiPropertyOptional({
    description: 'قالب مخصص',
    example: 'ابدأ الرد بكلمة أهلاً…',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  template?: string;
}
