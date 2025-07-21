// src/merchants/dto/leads-settings.dto.ts
import { IsArray, ValidateNested, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class LeadFieldDto {
  @IsString()
  key: string;

  @IsString()
  fieldType: string;

  @IsString()
  label: string;

  @IsString()
  placeholder: string;

  @IsBoolean()
  required: boolean;
}

export class LeadsSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadFieldDto)
  settings: LeadFieldDto[];
}
