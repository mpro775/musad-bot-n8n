// src/modules/knowledge/knowledge.controller.ts
import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('merchants/:merchantId/knowledge/urls')
export class KnowledgeController {
  constructor(private readonly svc: KnowledgeService) {}

  @Post()
  async uploadUrls(
    @Param('merchantId') merchantId: string,
    @Body('urls') urls: string[],
  ) {
    return this.svc.addUrls(merchantId, urls);
  }
  @Get(':merchantId/knowledge/urls/status')
  async getUrlsStatus(@Param('merchantId') merchantId: string) {
    return this.svc.getUrlsStatus(merchantId);
  }
  @Get()
  async getUrls(@Param('merchantId') merchantId: string) {
    return this.svc.getUrls(merchantId);
  }
}
