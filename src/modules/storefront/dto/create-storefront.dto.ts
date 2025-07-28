// src/modules/storefront/dto/create-storefront.dto.ts

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BannerDto {
  @IsOptional() @IsString() image?: string;
  @IsNotEmpty() @IsString() text: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() active?: boolean;
  @IsOptional() order?: number;
}

export class CreateStorefrontDto {
  @IsNotEmpty() @IsString() merchant: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string; // جديد
  @IsOptional() @IsEnum(['rounded', 'square']) buttonStyle?: string;
  @IsOptional() @IsString() slug?: string; // جديد
  @IsOptional() @IsString() domain?: string; // جديد
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerDto)
  banners?: BannerDto[];
  @IsOptional() @IsArray() featuredProductIds?: string[];
}

export class UpdateStorefrontDto extends CreateStorefrontDto {}
