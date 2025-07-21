// src/storefront/storefront.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { StorefrontService } from './storefront.service';

@Controller('store')
export class StorefrontController {
  constructor(private svc: StorefrontService) {}

  /** GET /api/store/:slugOrId */
  @Get(':slugOrId')
  async storefront(@Param('slugOrId') slugOrId: string) {
    return this.svc.getStorefront(slugOrId);
  }
}
