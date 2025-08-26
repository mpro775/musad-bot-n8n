// src/common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

/** شكل الاستجابة الموحدة */
export interface ApiResponseData<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  requestId?: string;
  timestamp: string;
}

/** Interceptor لتوحيد شكل الاستجابة */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseData<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseData<T>> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId;

    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      }))
    );
  }
}
