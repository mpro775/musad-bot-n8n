import { IsEnum, IsString, Matches } from 'class-validator';
import { WeekDay } from '../schemas/working-hours.schema';

export class WorkingHourDto {
  @IsEnum(WeekDay)
  day: WeekDay;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'openTime must be in HH:mm format',
  })
  openTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'closeTime must be in HH:mm format',
  })
  closeTime: string;
}
