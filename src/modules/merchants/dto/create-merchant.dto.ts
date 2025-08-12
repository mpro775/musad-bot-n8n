// src/merchants/dto/create-merchant.dto.ts

import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsObject,
  IsMongoId,
} from 'class-validator';

import { AddressDto } from './address.dto';
import { SubscriptionPlanDto } from './subscription-plan.dto';
import { QuickConfigDto } from './quick-config.dto';
import { ChannelsDto } from './channel.dto';
import { WorkingHourDto } from './working-hours.dto';
import { AdvancedTemplateDto } from './advanced-template.dto';

import { LeadsSettingsDto } from './leads-settings.dto';

export class CreateMerchantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];

  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  subscription: SubscriptionPlanDto;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  customCategory?: string;

  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuickConfigDto)
  quickConfig?: QuickConfigDto;
  // src/merchants/schemas/merchant.schema.ts

  @IsMongoId()
  userId!: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedTemplateDto)
  currentAdvancedConfig?: AdvancedTemplateDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdvancedTemplateDto)
  advancedConfigHistory?: AdvancedTemplateDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];

  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
  @IsOptional()
  @IsString()
  exchangePolicy?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadsSettingsDto)
  leadsSettings?: LeadsSettingsDto;

  @IsOptional()
  @IsString()
  shippingPolicy?: string;
}
