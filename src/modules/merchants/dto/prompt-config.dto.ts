import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IncludeSectionsDto {
  @ApiPropertyOptional({ description: 'تضمين قسم المنتجات', default: true })
  @IsOptional()
  @IsBoolean()
  products?: boolean;

  @ApiPropertyOptional({ description: 'تضمين قسم التعليمات', default: true })
  @IsOptional()
  @IsBoolean()
  instructions?: boolean;

  @ApiPropertyOptional({ description: 'تضمين قسم الأقسام', default: true })
  @IsOptional()
  @IsBoolean()
  categories?: boolean;

  @ApiPropertyOptional({ description: 'تضمين قسم السياسات', default: true })
  @IsOptional()
  @IsBoolean()
  policies?: boolean;

  @ApiPropertyOptional({ description: 'تضمين القسم المخصص', default: true })
  @IsOptional()
  @IsBoolean()
  custom?: boolean;
}

export class PromptConfigDto {
  @ApiPropertyOptional({ description: 'اللهجة', example: 'خليجي' })
  @IsOptional()
  @IsString()
  dialect?: string;

  @ApiPropertyOptional({ description: 'النغمة', example: 'ودّي' })
  @IsOptional()
  @IsString()
  @IsIn(['رسمي', 'ودّي', 'طريف'])
  tone?: string;

  @ApiPropertyOptional({
    description: 'تعليمات إضافية مخصّصة',
    example: 'إذا سأل عن الفواتير القديمة …',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  template?: string;

  @ApiPropertyOptional({ description: 'الأقسام المُدرجة في الـ Prompt' })
  @IsOptional()
  @ValidateNested()
  @Type(() => IncludeSectionsDto)
  include?: IncludeSectionsDto;
}
