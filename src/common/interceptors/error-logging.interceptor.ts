// src/common/interceptors/error-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorManagementService } from '../services/error-management.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { shouldBypass } from './bypass.util';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  constructor(
    private readonly errorManagementService: ErrorManagementService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (shouldBypass(request)) {
      return next.handle(); // لا تسجيل للأخطاء على /metrics
    }
    const { url, method, ip, headers } = request;
    const userAgent = headers['user-agent'];
    const requestId = (request as any).requestId;
    const userId = request.user?.userId;
    const merchantId = request.user?.merchantId;

    return next.handle().pipe(
      catchError((error) => {
        // تسجيل الخطأ
        this.errorManagementService
          .logError(error, {
            userId,
            merchantId,
            requestId,
            url,
            method,
            ip,
            userAgent,
          })
          .then((errorId) => {
            this.logger.debug(`Error logged with ID: ${errorId}`);
          })
          .catch((logError) => {
            this.logger.error('Failed to log error', logError);
          });

        // إعادة رمي الخطأ للمعالجة اللاحقة
        return throwError(() => error as Error);
      }),
    );
  }
}
