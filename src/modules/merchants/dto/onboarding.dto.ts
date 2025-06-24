// src/merchants/dto/onboarding.dto.ts

import { Type } from 'class-transformer';
import { IsString, IsOptional, IsUrl, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';
import { SubscriptionPlanDto } from './subscription-plan.dto';
import { ChannelsDto } from './channel.dto';

export class OnboardingDto {
  /** اسم المتجر */
  @IsString()
  name: string;

  /** رابط واجهة المتجر (اختياري) */
  @IsOptional()
  @IsUrl()
  storeUrl?: string;

  /** رابط شعار المتجر (اختياري) */
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  /** عنوان المتجر (اختياري) */
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  /** باقة الاشتراك */
  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  subscription: SubscriptionPlanDto;

  /** نوع العمل (اختياري) */
  @IsOptional()
  @IsString()
  businessType?: string;

  /** وصف العمل (اختياري) */
  @IsOptional()
  @IsString()
  businessDescription?: string;

  /** إعدادات القنوات (اختياري) */
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;
}
