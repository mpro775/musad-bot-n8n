// src/modules/auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'البريد الإلكتروني',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'كلمة المرور (6 أحرف فأكثر)',
    example: 'securePass',
  })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'اسم المستخدم أو التاجر', example: 'أحمد' })
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  name: string;
}
