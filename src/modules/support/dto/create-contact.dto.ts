// src/modules/support/dto/create-contact.dto.ts
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';


export enum ContactTopic {
SALES = 'sales',
SUPPORT = 'support',
BILLING = 'billing',
PARTNERSHIP = 'partnership',
}


export class CreateContactDto {
@IsString() @MinLength(2)
name!: string;


@IsEmail()
email!: string;


@IsOptional() @IsString()
phone?: string;


@IsEnum(ContactTopic)
topic!: ContactTopic;


@IsString() @MinLength(5) @MaxLength(200)
subject!: string;


@IsString() @MinLength(20) @MaxLength(5000)
message!: string;


// Honeypot لمكافحة السبام — يجب أن تُترك فارغة
@IsOptional() @IsString()
website?: string;


// reCAPTCHA v2/v3 (اختياري)
@IsOptional() @IsString()
recaptchaToken?: string;
}