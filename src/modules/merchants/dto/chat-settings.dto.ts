// src/modules/merchants/dto/chat-settings.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatSettingsDto {
  @ApiProperty({ example: '#D84315' })
  @IsString()
  @IsOptional()
  themeColor?: string;

  @ApiProperty({ example: 'مرحباً! كيف أستطيع مساعدتك اليوم؟' })
  @IsString()
  @IsOptional()
  greeting?: string;

  @ApiProperty({ example: '/api/webhooks' })
  @IsString()
  @IsOptional()
  webhooksUrl?: string;

  @ApiProperty({ example: 'http://localhost:3000' })
  @IsString()
  @IsOptional()
  apiBaseUrl?: string;
}
