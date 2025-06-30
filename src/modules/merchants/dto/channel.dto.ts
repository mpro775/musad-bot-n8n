// src/merchants/dto/channel.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** تفاصيل قناة واحدة (واتساب/تيليجرام/ويبشات) */
export class ChannelDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() token?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chatId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() webhookUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() widgetSettings?: Record<string, any>;
  /** رابط الويبهوك (اختياري) */
}

/** مجموعة القنوات كلها */
export class ChannelsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  whatsapp?: ChannelDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  telegram?: ChannelDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  webchat?: ChannelDetailsDto;
}
