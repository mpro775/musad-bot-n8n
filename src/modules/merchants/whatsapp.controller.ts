// src/merchants/whatsapp.controller.ts
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('merchants/:id/whatsapp')
export class WhatsappController {
  constructor(private readonly merchantsService: MerchantsService) {}

  // بدء جلسة جديدة - عرض QR code
  @Post('start-session')
  async startSession(@Param('id') id: string) {
    return this.merchantsService.connectWhatsapp(id);
  }

  // جلب حالة الاتصال
  @Get('status')
  async getStatus(@Param('id') id: string) {
    return this.merchantsService.getWhatsappStatus(id);
  }

  // إرسال رسالة (اختياري للاختبار/التجربة)
  @Post('send-message')
  async sendMsg(
    @Param('id') id: string,
    @Body() body: { to: string; text: string },
  ) {
    return this.merchantsService.sendWhatsappMessage(id, body.to, body.text);
  }
}
