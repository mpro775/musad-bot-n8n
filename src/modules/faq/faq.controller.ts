// src/modules/faq/faq.controller.ts
import { Controller, Post, Get, Body, Param, Delete } from '@nestjs/common';
import { FaqService } from './faq.service';

@Controller('merchants/:merchantId/faqs')
export class FaqController {
  constructor(private readonly svc: FaqService) {}

  @Post()
  async uploadFaqs(
    @Param('merchantId') merchantId: string,
    @Body() faqs: { question: string; answer: string }[],
  ) {
    return this.svc.createMany(merchantId, faqs);
  }

  @Get()
  async list(@Param('merchantId') merchantId: string) {
    return this.svc.list(merchantId);
  }

  @Delete(':faqId')
  async delete(
    @Param('merchantId') merchantId: string,
    @Param('faqId') faqId: string,
  ) {
    return this.svc.delete(merchantId, faqId);
  }
}
