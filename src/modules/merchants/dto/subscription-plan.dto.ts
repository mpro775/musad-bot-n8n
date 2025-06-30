// src/merchants/dto/subscription-plan.dto.ts
import {
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '../schemas/subscription-plan.schema';

export class SubscriptionPlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier) tier: PlanTier;

  @ApiProperty() @IsDateString() startDate: string;
  @ApiPropertyOptional() @IsDateString() endDate?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  features: string[];
}
