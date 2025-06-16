import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @ApiProperty({
    description: 'حالة التفعيل: true للتفعيل، false للتعطيل',
    example: true,
  })
  @IsBoolean()
  active: boolean;
}
