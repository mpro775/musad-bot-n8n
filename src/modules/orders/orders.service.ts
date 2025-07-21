// src/modules/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { LeadsService } from '../leads/leads.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private leadsService: LeadsService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const created = await this.orderModel.create(dto);
    await this.leadsService.create(dto.merchantId, {
      sessionId: dto.sessionId,
      data: dto.customer, // هنا تحفظ بيانات العميل (الاسم/الجوال/العنوان)
      source: 'order', // مصدر العميل: جاء عبر الطلبات
    });
    return created.toObject();
  }

  // جلب كل الطلبات
  async findAll(): Promise<Order[]> {
    return this.orderModel.find().sort({ createdAt: -1 }).exec();
  }

  // جلب طلب واحد مع تفاصيل المنتجات
  async findOne(id: string): Promise<Order | null> {
    return this.orderModel
      .findById(id)
      .populate('products.product') // يجلب بيانات المنتج مع الطلب
      .exec();
  }

  // تعديل حالة الطلب فقط
  async updateStatus(id: string, status: string): Promise<Order | null> {
    return this.orderModel.findByIdAndUpdate(id, { status }, { new: true });
  }
}
