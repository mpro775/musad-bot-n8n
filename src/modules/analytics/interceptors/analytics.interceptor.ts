// src/modules/analytics/interceptors/analytics.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  constructor(private readonly analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();

    // إذا لم يوجد merchantId فلا نسجّل الحدث
    const merchantId: string = req.params.merchantId || req.user?.merchantId;
    if (!merchantId) {
      return next.handle();
    }

    const channel: string = req.headers['x-channel'] || 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        // الآن merchantId مضمون موجود
        this.analyticsService.logEvent(merchantId, 'http_request', {
          method: req.method,
          path: req.url,
          duration,
          channel,
        });
      }),
    );
  }
}
