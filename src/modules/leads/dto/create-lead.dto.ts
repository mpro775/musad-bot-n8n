import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({ description: 'معرف الجلسة (sessionId)' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'بيانات النموذج كـ key/value object' })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({ description: 'مصدر الـ lead', required: false })
  @IsString()
  @IsOptional()
  source?: string;
}
