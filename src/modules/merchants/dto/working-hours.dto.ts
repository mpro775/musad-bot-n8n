import { IsEnum, IsString, Matches } from 'class-validator';
import { WeekDay } from '../schemas/working-hours.schema';
import { ApiProperty } from '@nestjs/swagger';

export class WorkingHourDto {
  @ApiProperty({ enum: WeekDay })
  @IsEnum(WeekDay)
  day: WeekDay;

  @ApiProperty({ description: 'وقت الفتح بصيغة HH:mm' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'openTime must be in HH:mm format',
  })
  openTime: string;

  @ApiProperty({ description: 'وقت الإغلاق بصيغة HH:mm' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'closeTime must be in HH:mm format',
  })
  closeTime: string;
}
