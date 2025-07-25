// src/modules/orders/orders.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  // جلب جميع الطلبات
  @Get()
  async findAll() {
    return this.ordersService.findAll();
  }

  // جلب طلب محدد بالتفصيل
  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // تعديل حالة الطلب (مثال: pending/paid/canceled)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
  @Public()
  @Get('by-customer/:merchantId/:phone')
  async findByCustomer(
    @Param('merchantId') merchantId: string,
    @Param('phone') phone: string,
  ) {
    // ابحث عن كل الطلبات لهذا العميل بناءً على رقم الجوال (أو حتى sessionId إذا متاح)
    return this.ordersService.findByCustomer(merchantId, phone);
  }
}
