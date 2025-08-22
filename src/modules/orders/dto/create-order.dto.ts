import {
  IsString,
  IsArray,
  IsObject,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsEmail,
  IsPhoneNumber,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({
    description: 'ظ…ط¹ط±ظپ ط§ظ„ظ…ظ†طھط¬',
    example: 'prod-123',
    required: true,
  })
  @IsString({
    message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ط¹ط±ظپ ط§ظ„ظ…ظ†طھط¬ ظ†طµظٹظ‹ط§',
  })
  @IsNotEmpty({ message: 'ظ…ط¹ط±ظپ ط§ظ„ظ…ظ†طھط¬ ظ…ط·ظ„ظˆط¨' })
  productId: string;

  @ApiProperty({
    description: 'ظƒظ…ظٹط© ط§ظ„ظ…ظ†طھط¬',
    minimum: 1,
    example: 2,
    required: true,
  })
  @IsNumber({}, { message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ظƒظ…ظٹط© ط±ظ‚ظ…ظٹط©' })
  @Min(1, { message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ظƒظ…ظٹط© ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ 1' })
  quantity: number;

  @ApiProperty({
    description: 'ط³ط¹ط± ط§ظ„ظˆط­ط¯ط©',
    minimum: 0,
    example: 100,
    required: true,
  })
  @IsNumber({}, { message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط³ط¹ط± ط±ظ‚ظ…ظٹظ‹ط§' })
  @Min(0, {
    message:
      'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط³ط¹ط± ط£ظƒط¨ط± ظ…ظ† ط£ظˆ ظٹط³ط§ظˆظٹ طµظپط±',
  })
  price: number;

  @ApiProperty({
    description: 'ط§ط³ظ… ط§ظ„ظ…ظ†طھط¬',
    example: 'ظ…ظ†طھط¬ ظ…ظ…ظٹط²',
    required: true,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ط³ظ… ط§ظ„ظ…ظ†طھط¬ ظ†طµظٹظ‹ط§' })
  @IsNotEmpty({ message: 'ط§ط³ظ… ط§ظ„ظ…ظ†طھط¬ ظ…ط·ظ„ظˆط¨' })
  name: string;

  @ApiPropertyOptional({
    description: 'ظ…ظ„ط§ط­ط¸ط§طھ ط¥ط¶ط§ظپظٹط© ط¹ظ„ظ‰ ط§ظ„ظ…ظ†طھط¬',
    example: 'ط§ظ„ظ„ظˆظ†: ط£ط­ط¬ط§ظ…',
    required: false,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ظ…ظ„ط§ط­ط¸ط§طھ ظ†طµظٹط©' })
  @IsOptional()
  notes?: string;
}

class CustomerDto {
  @ApiProperty({
    description: 'ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„',
    example: 'ظ…ط­ظ…ط¯ ط£ط­ظ…ط¯',
    required: true,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„ ظ†طµظٹظ‹ط§' })
  @IsNotEmpty({ message: 'ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„ ظ…ط·ظ„ظˆط¨' })
  name: string;

  @ApiProperty({
    description: 'ط±ظ‚ظ… ظ‡ط§طھظپ ط§ظ„ط¹ظ…ظٹظ„',
    example: '+966501234567',
    required: true,
  })
  @IsPhoneNumber('SA', {
    message:
      'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ط؛ظٹط± طµط§ظ„ط­. ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط±ظ‚ظ… ظ‡ط§طھظپ ط³ط¹ظˆط¯ظٹ طµط§ظ„ط­',
  })
  @IsNotEmpty({ message: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ظ…ط·ظ„ظˆط¨' })
  phone: string;

  @ApiPropertyOptional({
    description: 'رقم الهاتف الموحّد بدون رموز',
    example: '966501234567',
    required: false,
  })
  @IsString({ message: 'يجب أن يكون رقم الهاتف الموحّد نصيًا' })
  @IsOptional()
  phoneNormalized?: string;

  @ApiPropertyOptional({
    description: 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظ„ظ„ط¹ظ…ظٹظ„',
    example: 'customer@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط؛ظٹط± طµط§ظ„ط­' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'ط¹ظ†ظˆط§ظ† ط§ظ„ط¹ظ…ظٹظ„',
    type: Object,
    required: false,
    example: {
      street: 'ط´ط§ط±ط¹ ط§ظ„ظ…ظ„ظƒ ظپظ‡ط¯',
      city: 'ط§ظ„ط±ظٹط§ط¶',
      country: 'ط§ظ„ظ…ظ…ظ„ظƒط© ط§ظ„ط¹ط±ط¨ظٹط© ط§ظ„ط³ط¹ظˆط¯ظٹط©',
    },
  })
  @IsObject({ message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط¹ظ†ظˆط§ظ† ظƒط§ط¦ظ†ظ‹ط§' })
  @IsOptional()
  address?: Record<string, any>;
}

/**
 * ظ†ظ…ظˆط°ط¬ ط¥ظ†ط´ط§ط، ط·ظ„ط¨ ط¬ط¯ظٹط¯
 * ظٹط­طھظˆظٹ ط¹ظ„ظ‰ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ظ„ط¨ ط§ظ„ط£ط³ط§ط³ظٹط© ط§ظ„ظ…ط·ظ„ظˆط¨ط© ظ„ط¥ظ†ط´ط§ط، ط·ظ„ط¨ ط¬ط¯ظٹط¯
 */
export class CreateOrderDto {
  @ApiProperty({
    description: 'ظ…ط¹ط±ظپ ط§ظ„طھط§ط¬ط±',
    example: 'merchant-123',
    required: true,
  })
  @IsString({
    message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ط¹ط±ظپ ط§ظ„طھط§ط¬ط± ظ†طµظٹظ‹ط§',
  })
  @IsNotEmpty({ message: 'ظ…ط¹ط±ظپ ط§ظ„طھط§ط¬ط± ظ…ط·ظ„ظˆط¨' })
  merchantId: string;

  @ApiProperty({
    description: 'ظ…ط¹ط±ظپ ط§ظ„ط¬ظ„ط³ط©',
    example: 'session-456',
    required: true,
  })
  @IsString({
    message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ط¹ط±ظپ ط§ظ„ط¬ظ„ط³ط© ظ†طµظٹظ‹ط§',
  })
  @IsNotEmpty({ message: 'ظ…ط¹ط±ظپ ط§ظ„ط¬ظ„ط³ط© ظ…ط·ظ„ظˆط¨' })
  sessionId: string;

  @ApiPropertyOptional({
    description: 'ظ…ط¹ط±ظپ ط§ظ„ط·ظ„ط¨',
    example: 'order-123',
    required: false,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ط¹ط±ظپ ط§ظ„ط·ظ„ط¨ ظ†طµظٹظ‹ط§' })
  @IsOptional()
  source: string;

  @ApiPropertyOptional({
    description:
      'طھط§ط±ظٹط® ط¥ظ†ط´ط§ط، ط§ظ„ط·ظ„ط¨ (ط§ط®طھظٹط§ط±ظٹ - ط³ظٹطھظ… طھط¹ظٹظٹظ†ظ‡ طھظ„ظ‚ط§ط¦ظٹظ‹ط§ ط¥ط°ط§ ظ„ظ… ظٹطھظ… طھظˆظپظٹط±ظ‡)',
    type: Date,
    example: '2023-01-01T12:00:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† طھط§ط±ظٹط®ظ‹ط§ طµط§ظ„ط­ظ‹ط§' },
  )
  @IsOptional()
  createdAt?: Date;

  @ApiProperty({
    description: 'ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ…ظٹظ„',
    type: CustomerDto,
    required: true,
  })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ApiProperty({
    description: 'ط¹ظ†ط§طµط± ط§ظ„ط·ظ„ط¨',
    type: [OrderItemDto],
    required: true,
    minItems: 1,
  })
  @IsArray({ message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ط¹ظ†ط§طµط± ظ…طµظپظˆظپط©' })
  @ArrayMinSize(1, {
    message:
      'ظٹط¬ط¨ ط£ظ† ظٹط­طھظˆظٹ ط§ظ„ط·ظ„ط¨ ط¹ظ„ظ‰ ط¹ظ†طµط± ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'ط¨ظٹط§ظ†ط§طھ ط¥ط¶ط§ظپظٹط© ظ„ظ„ط·ظ„ط¨',
    type: Object,
    required: false,
    example: {
      source: 'website',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    },
  })
  @IsObject({
    message:
      'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ظˆطµظپظٹط© ظƒط§ط¦ظ†ظ‹ط§',
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'ظ…ط¹ط±ظپ ط§ظ„ط·ظ„ط¨',
    example: 'order-123',
    required: false,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ط¹ط±ظپ ط§ظ„ط·ظ„ط¨ ظ†طµظٹظ‹ط§' })
  @IsOptional()
  externalId?: string;

  @ApiPropertyOptional({
    description: 'ط­ط§ظ„ط© ط§ظ„ط³ط¯ط§ط¯ (ط§ظپطھط±ط§ط¶ظٹ: false)',
    type: Boolean,
    default: false,
    required: false,
  })
  @IsBoolean({
    message:
      'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط­ط§ظ„ط© ط§ظ„ط³ط¯ط§ط¯ ظ‚ظٹظ…ط© ظ…ظ†ط·ظ‚ظٹط©',
  })
  @IsOptional()
  isPaid?: boolean = false;

  @ApiPropertyOptional({
    description:
      'ط¥ط¬ظ…ط§ظ„ظٹ ظ…ط¨ظ„ط؛ ط§ظ„ط·ظ„ط¨ (ط³ظٹطھظ… ط­ط³ط§ط¨ظ‡ طھظ„ظ‚ط§ط¦ظٹظ‹ط§ ط¥ط°ط§ ظ„ظ… ظٹطھظ… طھظˆظپظٹط±ظ‡)',
    type: Number,
    minimum: 0,
    example: 200,
    required: false,
  })
  @IsNumber(
    {},
    { message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ ط±ظ‚ظ…ظٹظ‹ط§' },
  )
  @Min(0, {
    message:
      'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ ط£ظƒط¨ط± ظ…ظ† ط£ظˆ ظٹط³ط§ظˆظٹ طµظپط±',
  })
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({
    description:
      'ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨ (ظ…ط«ظ„: pending, processing, completed, cancelled)',
    example: 'pending',
    default: 'pending',
    required: false,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ط­ط§ظ„ط© ظ†طµظٹط©' })
  @IsOptional()
  status?: string = 'pending';

  @ApiPropertyOptional({
    description: 'ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹',
    example: 'credit_card',
    required: false,
  })
  @IsString({
    message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹ ظ†طµظٹط©',
  })
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'طھط§ط±ظٹط® ظˆظˆظ‚طھ ط§ظ„ط³ط¯ط§ط¯',
    type: Date,
    example: '2023-01-01T12:30:00.000Z',
    required: false,
  })
  @IsDateString(
    {},
    { message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† طھط§ط±ظٹط® ط§ظ„ط³ط¯ط§ط¯ طµط§ظ„ط­ظ‹ط§' },
  )
  @IsOptional()
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'ظ…ظ„ط§ط­ط¸ط§طھ ط¥ط¶ط§ظپظٹط© ط¹ظ„ظ‰ ط§ظ„ط·ظ„ط¨',
    example: 'ط§ظ„طھظˆطµظٹظ„ ط¨ط¹ط¯ ط§ظ„ط³ط§ط¹ط© 5 ظ…ط³ط§ط،ظ‹',
    required: false,
  })
  @IsString({ message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط§ظ„ظ…ظ„ط§ط­ط¸ط§طھ ظ†طµظٹط©' })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'ط±ظ‚ظ… ط§ظ„ظپط§طھظˆط±ط© (ط¥ط°ط§ ظƒط§ظ† ظ…طھط§ط­ظ‹ط§)',
    example: 'INV-2023-001',
    required: false,
  })
  @IsString({
    message: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط±ظ‚ظ… ط§ظ„ظپط§طھظˆط±ط© ظ†طµظٹظ‹ط§',
  })
  @IsOptional()
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ظ†طھط¬ط§طھ',
    type: Object,
    required: false,
    example: {
      productId: 'prod-123',
      name: 'ظ…ظ†طھط¬ ظ…ظ…ظٹط²',
      quantity: 2,
      price: 100,
    },
  })
  @IsObject({
    message: 'ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ظ†طھط¬ط§طھ ظƒط§ط¦ظ†ظ‹ط§',
  })
  @IsOptional()
  products?: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}
