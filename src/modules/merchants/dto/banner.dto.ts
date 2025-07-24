// src/modules/merchants/dto/banner.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class BannerDto {
  @ApiProperty({ required: false, description: 'رابط الصورة' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ required: true, description: 'نص البانر' })
  @IsString()
  text: string;

  @ApiProperty({ required: false, description: 'رابط عند الضغط' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ required: false, description: 'لون الخلفية' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false, description: 'هل نشط؟' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ required: false, description: 'ترتيب البانر' })
  @IsOptional()
  @IsNumber()
  order?: number;
}
