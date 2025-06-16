import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class RollbackDto {
  @ApiProperty({
    description: 'رقم النسخة التي تريد الرجوع إليها',
    example: 2,
  })
  @IsInt()
  @Min(1)
  version: number;
}
