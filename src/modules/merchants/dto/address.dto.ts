// src/merchants/dto/address.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty() @IsString() street: string;
  @ApiProperty() @IsString() city: string;
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsString() postalCode?: string;
}
