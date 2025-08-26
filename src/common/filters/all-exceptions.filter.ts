// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** فلتر استثناءات موحّد يعيد عقد أخطاء ثابت */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = (request as any)?.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: any = {
      status,
      code: 'INTERNAL_ERROR',
      message: 'حدث خطأ غير متوقع، الرجاء المحاولة لاحقًا',
      requestId,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // لو الاستثناء أصلاً صيغ كعقد موحّد
      if (typeof res === 'object' && res !== null && 'code' in (res as any)) {
        payload = { requestId, status, ...(res as any) };
      } else {
        payload = {
          status,
          code: 'HTTP_EXCEPTION',
          message: typeof res === 'string' ? res : (res as any)?.message ?? 'خطأ',
          requestId,
        };
      }
    } else if (exception && typeof exception === 'object') {
      const anyEx = exception as any;
      if (anyEx?.code && anyEx?.message) {
        payload = { status, requestId, code: anyEx.code, message: anyEx.message, details: anyEx.details };
      }
    }

    // غير مناسب عرض stack للمستخدم النهائي
    response.status(status).json(payload);
  }
}
