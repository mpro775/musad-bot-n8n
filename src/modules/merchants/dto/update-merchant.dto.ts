// src/modules/merchants/dto/update-merchant.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateMerchantDto } from './create-merchant.dto';

export class UpdateMerchantDto extends PartialType(CreateMerchantDto) {}
