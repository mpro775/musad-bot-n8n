import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HandoffDto {
  @ApiProperty({ description: 'Session ID' }) @IsString() sessionId: string;
  @ApiProperty({ description: 'Optional note/reason' })
  @IsOptional()
  @IsString()
  note?: string;
}
