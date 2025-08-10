// src/merchants/dto/update-product-source.dto.ts
import { IsIn } from 'class-validator';
export class UpdateProductSourceDto {
  @IsIn(['internal', 'salla', 'zid'])
  source: 'internal' | 'salla' | 'zid';
}
