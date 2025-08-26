// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Decorator للحصول على المستخدم الحالي من الطلب */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // إذا تم تحديد خاصية معينة
    if (data && user) {
      return user[data];
    }

    return user;
  },
);

/** Decorator للحصول على معرف المستخدم */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id;
  },
);

/** Decorator للحصول على معرف التاجر */
export const CurrentMerchantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.merchantId;
  },
);
