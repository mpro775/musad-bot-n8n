// src/merchants/dto/create-merchant.dto.ts

import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AddressDto } from './address.dto';
import { SubscriptionPlanDto } from './subscription-plan.dto';
import { QuickConfigDto } from './quick-config.dto';
import { ChannelsDto } from './channel.dto';
import { WorkingHourDto } from './working-hours.dto';
import { AdvancedTemplateDto } from './advanced-template.dto';

export class CreateMerchantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  storefrontUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  // أضفنا العنوان هنا
  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ type: SubscriptionPlanDto })
  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  subscription: SubscriptionPlanDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional({ type: QuickConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuickConfigDto)
  quickConfig?: QuickConfigDto;

  @ApiPropertyOptional({ type: AdvancedTemplateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedTemplateDto)
  currentAdvancedConfig?: AdvancedTemplateDto;

  @ApiPropertyOptional({ type: [AdvancedTemplateDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdvancedTemplateDto)
  advancedConfigHistory?: AdvancedTemplateDto[];

  @ApiPropertyOptional({ type: ChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;

  @ApiPropertyOptional({ type: [WorkingHourDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangePolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingPolicy?: string;
}
