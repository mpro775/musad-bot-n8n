// src/storefront/storefront.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Storefront')
@Controller('store')
export class StorefrontController {
  constructor(private svc: StorefrontService) {}

  /** GET /api/store/:slugOrId */
  @Get(':slugOrId')
  @ApiOperation({ summary: 'Get storefront by slug or merchantId' })
  @ApiParam({ name: 'slugOrId', description: 'Merchant slug or ID' })
  @ApiOkResponse({ description: 'Storefront data' })
  async storefront(@Param('slugOrId') slugOrId: string) {
    return this.svc.getStorefront(slugOrId);
  }
}
