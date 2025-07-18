// src/auth/dto/verify-email.dto.ts
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
