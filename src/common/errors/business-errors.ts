// src/common/errors/business-errors.ts
import { HttpStatus } from '@nestjs/common';
import { DomainError } from './domain-error';
import { ERROR_CODES } from '../constants/error-codes';

/** أخطاء الأعمال المتخصصة */
export class BusinessError extends DomainError {
  constructor(
    code: string,
    message: string,
    status: number = HttpStatus.BAD_REQUEST,
    details?: any
  ) {
    super(code, message, status, details);
  }
}

// أخطاء المنتجات
export class ProductNotFoundError extends BusinessError {
  constructor(productId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'المنتج غير موجود',
      HttpStatus.NOT_FOUND,
      { productId }
    );
  }
}

export class OutOfStockError extends BusinessError {
  constructor(productId: string, availableQuantity: number = 0) {
    super(
      ERROR_CODES.OUT_OF_STOCK,
      'المنتج غير متوفر حاليًا',
      HttpStatus.CONFLICT,
      { productId, availableQuantity }
    );
  }
}

// أخطاء الطلبات
export class OrderNotFoundError extends BusinessError {
  constructor(orderId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'الطلب غير موجود',
      HttpStatus.NOT_FOUND,
      { orderId }
    );
  }
}

export class OrderAlreadyProcessedError extends BusinessError {
  constructor(orderId: string, status: string) {
    super(
      ERROR_CODES.ORDER_ALREADY_PROCESSED,
      'الطلب تم معالجته مسبقاً',
      HttpStatus.CONFLICT,
      { orderId, status }
    );
  }
}

// أخطاء المستخدمين
export class UserNotFoundError extends BusinessError {
  constructor(userId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'المستخدم غير موجود',
      HttpStatus.NOT_FOUND,
      { userId }
    );
  }
}

export class MerchantNotFoundError extends BusinessError {
  constructor(merchantId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'التاجر غير موجود',
      HttpStatus.NOT_FOUND,
      { merchantId }
    );
  }
}

export class CategoryNotFoundError extends BusinessError {
  constructor(categoryId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'الفئة غير موجودة',
      HttpStatus.NOT_FOUND,
      { categoryId }
    );
  }
}

export class NotificationNotFoundError extends BusinessError {
  constructor(notificationId: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      'الإشعار غير موجود',
      HttpStatus.NOT_FOUND,
      { notificationId }
    );
  }
}

export class InsufficientBalanceError extends BusinessError {
  constructor(userId: string, required: number, available: number) {
    super(
      ERROR_CODES.INSUFFICIENT_BALANCE,
      'رصيد غير كافي',
      HttpStatus.CONFLICT,
      { userId, required, available }
    );
  }
}

// أخطاء التكامل
export class ExternalServiceError extends BusinessError {
  constructor(serviceName: string, originalError?: any) {
    super(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      `خطأ في خدمة ${serviceName}`,
      HttpStatus.BAD_GATEWAY,
      { serviceName, originalError }
    );
  }
}

export class WebhookFailedError extends BusinessError {
  constructor(webhookUrl: string, statusCode: number) {
    super(
      ERROR_CODES.WEBHOOK_FAILED,
      'فشل في إرسال webhook',
      HttpStatus.BAD_GATEWAY,
      { webhookUrl, statusCode }
    );
  }
}
