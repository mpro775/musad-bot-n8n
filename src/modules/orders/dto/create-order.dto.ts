// src/modules/orders/dto/create-order.dto.ts
import { IsString, IsArray, IsObject, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  merchantId: string;

  @IsString()
  sessionId: string;

  @IsObject()
  customer: Record<string, any>;

  @IsArray()
  products: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;

  @IsOptional()
  @IsString()
  status?: string;
}
