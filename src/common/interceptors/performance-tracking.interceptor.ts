// src/common/interceptors/performance-tracking.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { SentryService } from '../services/sentry.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { shouldBypass } from './bypass.util';

@Injectable()
export class PerformanceTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceTrackingInterceptor.name);

  constructor(private readonly sentryService: SentryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const { url, method, ip, headers } = request;
    const userAgent = headers['user-agent'];
    const requestId = (request as any).requestId;
    const userId = request.user?.userId;
    const merchantId = request.user?.merchantId;
    if (shouldBypass(request)) {
      return next.handle(); // لا تبدأ معاملة Sentry لمسار /metrics
    }
    // إنشاء اسم المعاملة
    const operationName = `${method} ${url}`;
    const operationType = 'http.server';

    // بدء تتبع الأداء
    const transaction = this.sentryService.startTransaction(
      operationName,
      operationType,
      {
        userId,
        merchantId,
        requestId,
        url,
        method,
        ip,
        userAgent,
      },
    );

    if (!transaction) {
      // إذا لم يتم بدء المعاملة، نتابع بدون تتبع
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          // تسجيل نجاح العملية
          transaction.setStatus('ok');
          transaction.setData('response_size', JSON.stringify(data).length);
        },
        error: (error) => {
          // تسجيل فشل العملية
          transaction.setStatus('internal_error');
          transaction.setData('error_message', error.message);
          transaction.setData('error_code', error.status || 500);
        },
      }),
      finalize(() => {
        const duration = Date.now() - startTime;

        // إضافة بيانات الأداء
        transaction.setData('duration_ms', duration);
        transaction.setData('request_id', requestId);

        // إضافة تاج للأداء
        if (duration > 5000) {
          transaction.setTag('performance', 'slow');
        } else if (duration > 1000) {
          transaction.setTag('performance', 'medium');
        } else {
          transaction.setTag('performance', 'fast');
        }

        // إنهاء المعاملة
        transaction.finish();

        // تسجيل الأداء في السجلات
        if (duration > 3000) {
          this.logger.warn(
            `Slow request detected: ${operationName} took ${duration}ms`,
            {
              duration,
              url,
              method,
              userId,
              merchantId,
              requestId,
            },
          );
        } else {
          this.logger.debug(
            `Request completed: ${operationName} took ${duration}ms`,
          );
        }
      }),
    );
  }
}
