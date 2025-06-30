// src/merchants/dto/onboarding.dto.ts

import { Type } from 'class-transformer';
import { IsString, IsOptional, IsUrl, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from './address.dto';
import { SubscriptionPlanDto } from './subscription-plan.dto';
import { ChannelsDto } from './channel.dto';

export class OnboardingDto {
  /** اسم المتجر */
  @ApiProperty()
  @IsString()
  name: string;

  /** رابط واجهة المتجر (اختياري) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  storeUrl?: string;

  /** رابط شعار المتجر (اختياري) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  /** عنوان المتجر (اختياري) */
  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  /** باقة الاشتراك */
  @ApiProperty({ type: SubscriptionPlanDto })
  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  subscription: SubscriptionPlanDto;

  /** نوع العمل (اختياري) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  /** وصف العمل (اختياري) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessDescription?: string;

  /** إعدادات القنوات (اختياري) */
  @ApiPropertyOptional({ type: ChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;
}
