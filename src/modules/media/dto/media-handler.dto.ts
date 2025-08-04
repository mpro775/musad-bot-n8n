// src/media/dto/media-handler.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum MediaType {
  TEXT = 'text',
  VOICE = 'voice',
  AUDIO = 'audio',
  PHOTO = 'photo',
  IMAGE = 'image',
  DOCUMENT = 'document',
  PDF = 'pdf',
}

export class MediaHandlerDto {
  @IsEnum(MediaType)
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  channel?: string; // whatsapp, telegram, webchat, etc.

  @IsOptional()
  @IsString()
  mimeType?: string;
}
