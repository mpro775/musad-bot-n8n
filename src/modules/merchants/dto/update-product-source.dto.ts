import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ProductSource = 'internal' | 'salla' | 'zid';
export type SyncMode = 'none' | 'immediate' | 'background';

export class UpdateProductSourceDto {
  @ApiProperty({ enum: ['internal', 'salla', 'zid'], example: 'salla' })
  @IsIn(['internal', 'salla', 'zid'])
  source: ProductSource;

  @ApiProperty({ description: 'تأكيد بكلمة المرور' })
  @IsString()
  @MinLength(6)
  confirmPassword: string;

  @ApiPropertyOptional({ enum: ['none','immediate','background'], default: 'background' })
  @IsOptional()
  @IsIn(['none', 'immediate', 'background'])
  syncMode?: SyncMode = 'background';
}
