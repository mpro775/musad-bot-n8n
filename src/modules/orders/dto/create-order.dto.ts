import {
  IsString,
  IsArray,
  IsObject,
  IsOptional,
  IsDate,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  merchantId: string;

  @IsString()
  sessionId: string;
  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsObject()
  customer: Record<string, any>;

  @IsArray()
  products: Array<{
    productId?: string; // productId اختياري لو الطلب من زد (ممكن productId غير متوفر)
    name: string;
    quantity: number;
    price: number;
  }>;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
