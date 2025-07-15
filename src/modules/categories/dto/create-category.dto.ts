// src/modules/categories/dto/create-category.dto.ts

import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  parent?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  keywords?: string[];
}
