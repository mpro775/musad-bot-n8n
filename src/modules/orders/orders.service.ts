// src/modules/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { LeadsService } from '../leads/leads.service';
import { Order as OrderType } from '../webhooks/helpers/order';

function toOrderType(orderDoc: any): OrderType {
  return {
    _id: orderDoc._id?.toString?.() ?? orderDoc._id,
    status: orderDoc.status,
    createdAt: orderDoc.createdAt
      ? orderDoc.createdAt instanceof Date
        ? orderDoc.createdAt.toISOString()
        : orderDoc.createdAt
      : '',
    customer: {
      name: orderDoc.customer?.name,
      phone: orderDoc.customer?.phone,
      address: orderDoc.customer?.address,
    },
    products: Array.isArray(orderDoc.products)
      ? orderDoc.products.map((p: any) => ({
          name: p.name,
          quantity: p.quantity,
          price: p.price,
        }))
      : [],
  };
}
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
  async findOne(orderId: string): Promise<OrderType | null> {
    const orderDoc = await this.orderModel.findById(orderId).lean(); // أو .exec()
    return orderDoc ? toOrderType(orderDoc) : null;
  }

  // تعديل حالة الطلب فقط
  async updateStatus(id: string, status: string): Promise<Order | null> {
    return this.orderModel.findByIdAndUpdate(id, { status }, { new: true });
  }
  async findByCustomer(merchantId: string, phone: string): Promise<Order[]> {
    return this.orderModel
      .find({
        merchantId,
        'customer.phone': phone, // أو أي key آخر يحفظ رقم العميل
      })
      .sort({ createdAt: -1 });
  }
}
