import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWidgetSettingsDto {
  // General
  @ApiPropertyOptional() @IsString() @IsOptional() botName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() welcomeMessage?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;

  // Appearance
  @ApiPropertyOptional({
    enum: ['default', 'gray', 'blue', 'purple', 'custom'],
  })
  @IsEnum(['default', 'gray', 'blue', 'purple', 'custom'])
  @IsOptional()
  theme?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() brandColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() fontFamily?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() headerBgColor?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyBgColor?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() handoffEnabled?: boolean;
  @ApiPropertyOptional({ enum: ['slack', 'email', 'webhook'] })
  @IsEnum(['slack', 'email', 'webhook'])
  @IsOptional()
  handoffChannel?: 'slack' | 'email' | 'webhook';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: false }) // هنا يمكن تحسين حسب config المطلوب
  handoffConfig?: Record<string, any>;

  // Tags
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  topicsTags?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  sentimentTags?: string[];
  @ApiPropertyOptional() @IsBoolean() @IsOptional() autoTagging?: boolean;

  @ApiPropertyOptional({
    enum: ['bubble', 'iframe', 'bar', 'conversational'],
    description: 'Default embed mode',
  })
  @IsEnum(['bubble', 'iframe', 'bar', 'conversational'])
  @IsOptional()
  embedMode?: 'bubble' | 'iframe' | 'bar' | 'conversational';
}
