// src/merchants/dto/address.dto.ts
import { IsString } from 'class-validator';

export class AddressDto {
  @IsString() street: string;
  @IsString() city: string;
  @IsString() country: string;
  @IsString() state?: string;
  @IsString() postalCode?: string;
}
