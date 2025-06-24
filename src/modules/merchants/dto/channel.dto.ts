// src/merchants/dto/channel.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
} from 'class-validator';

/** تفاصيل قناة واحدة (واتساب/تيليجرام/ويبشات) */
export class ChannelDetailsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsString() chatId?: string;
  @IsOptional() @IsString() webhookUrl?: string;
  @IsOptional() @IsObject() widgetSettings?: Record<string, any>;
  /** رابط الويبهوك (اختياري) */
}

/** مجموعة القنوات كلها */
export class ChannelsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  whatsapp?: ChannelDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  telegram?: ChannelDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelDetailsDto)
  webchat?: ChannelDetailsDto;
}
