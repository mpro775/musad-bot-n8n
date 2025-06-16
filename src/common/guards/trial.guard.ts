// src/common/guards/trial.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { MerchantDocument } from 'src/modules/merchants/schemas/merchant.schema';

@Injectable()
export class TrialGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const merchant = request.user.merchant as MerchantDocument;
    if (!merchant.planPaid && new Date() > merchant.trialEndsAt) {
      throw new ForbiddenException('Your trial has expired');
    }
    return true;
  }
}
