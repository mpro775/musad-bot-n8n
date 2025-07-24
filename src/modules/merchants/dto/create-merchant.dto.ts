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
} from 'class-validator';

import { AddressDto } from './address.dto';
import { SubscriptionPlanDto } from './subscription-plan.dto';
import { QuickConfigDto } from './quick-config.dto';
import { ChannelsDto } from './channel.dto';
import { WorkingHourDto } from './working-hours.dto';
import { AdvancedTemplateDto } from './advanced-template.dto';
import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { LeadsSettingsDto } from './leads-settings.dto';
import { BannerDto } from './banner.dto';

export class CreateMerchantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUrl()
  storefrontUrl?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];

  @IsOptional()
  @IsString()
  slug?: string;

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
  domain?: string;

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
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

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
  @IsArray()
  banners?: BannerDto[];

  @IsOptional()
  @IsString()
  shippingPolicy?: string;
}
