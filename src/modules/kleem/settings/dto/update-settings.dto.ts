import {
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class UpdateBotRuntimeSettingsDto {
  @IsOptional() @IsString() launchDate?: string;
  @IsOptional() @IsString() applyUrl?: string;
  @IsOptional() @IsString() integrationsNow?: string;
  @IsOptional() @IsString() trialOffer?: string;
  @IsOptional() @IsString() yemenNext?: string;
  @IsOptional() @IsString() yemenPositioning?: string;

  @IsOptional() @IsNumber() ctaEvery?: number;
  @IsOptional() @IsArray() @ArrayNotEmpty() highIntentKeywords?: string[];
  @IsOptional() @IsArray() @ArrayNotEmpty() piiKeywords?: string[];
}
