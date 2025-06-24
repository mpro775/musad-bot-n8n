// src/merchants/dto/subscription-plan.dto.ts
import {
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsString,
} from 'class-validator';
import { PlanTier } from '../schemas/subscription-plan.schema';

export class SubscriptionPlanDto {
  @IsEnum(PlanTier) tier: PlanTier;

  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  features: string[];
}
