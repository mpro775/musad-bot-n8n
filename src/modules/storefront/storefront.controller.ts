// src/storefront/storefront.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateStorefrontDto } from './dto/update-storefront.dto';
import { CreateStorefrontDto } from './dto/create-storefront.dto';
@UseGuards(JwtAuthGuard)
@Controller('store')
export class StorefrontController {
  constructor(private svc: StorefrontService) {}

  @Get(':slugOrId')
  @Public()
  async storefront(@Param('slugOrId') slugOrId: string) {
    return this.svc.getStorefront(slugOrId);
  }
  @Post()
  async create(@Body() dto: CreateStorefrontDto) {
    return this.svc.create(dto);
  }

  // جلب بيانات الواجهة عبر معرف التاجر
  @Get('merchant/:merchantId')
  async findByMerchant(@Param('merchantId') merchantId: string) {
    return this.svc.findByMerchant(merchantId);
  }

  // تحديث حسب معرف واجهة المتجر
  @Patch('merchant/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateStorefrontDto) {
    return this.svc.update(id, dto);
  }

  // تحديث حسب معرف التاجر مباشرة (لتسهيل التكامل مع الـ Frontend)
  @Patch('merchant/:merchantId')
  async updateByMerchant(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateStorefrontDto,
  ) {
    return this.svc.updateByMerchant(merchantId, dto);
  }
}
