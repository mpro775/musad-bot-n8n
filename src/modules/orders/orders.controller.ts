// src/modules/orders/orders.controller.ts
import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ description: 'Order created' })
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  // جلب جميع الطلبات
  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiOkResponse({ description: 'List of orders' })
  async findAll() {
    return this.ordersService.findAll();
  }

  // جلب طلب محدد بالتفصيل
  @Get(':id')
  @ApiOperation({ summary: 'Get one order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({ description: 'Order details' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // تعديل حالة الطلب (مثال: pending/paid/canceled)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Status updated' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
