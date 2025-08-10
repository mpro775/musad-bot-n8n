// src/catalog/catalog.controller.ts (مبسّط)
import { Controller, Param, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Post(':merchantId/sync')
  sync(@Param('merchantId') merchantId: string) {
    return this.svc.syncForMerchant(merchantId);
  }
}
