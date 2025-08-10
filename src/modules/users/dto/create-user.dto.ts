// src/modules/users/dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';

export class CreateUserDto {
  id: string;

  @ApiProperty({
    description: 'البريد الإلكتروني للمستخدم',
    example: 'admin@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'رقم الجوال', example: '+970599123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'اسم المستخدم', example: 'Ahmed Alsaeed' })
  @IsString()
  @MinLength(3)
  name: string;

  merchantId: string | null;
  firstLogin: boolean;

  @ApiPropertyOptional({
    description: 'الدور الخاص بالمستخدم',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
