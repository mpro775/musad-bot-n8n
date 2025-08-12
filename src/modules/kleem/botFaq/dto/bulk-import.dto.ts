// src/modules/kleem/botFaq/dto/bulk-import.dto.ts
import { Type } from 'class-transformer';
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { CreateBotFaqDto } from './create-botFaq.dto';

export class BulkImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateBotFaqDto)
  items: CreateBotFaqDto[];
}
