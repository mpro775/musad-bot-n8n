// src/modules/orders/schemas/order.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class OrderProduct {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  // Snapshot من بيانات المنتج لحظة الطلب (اختياري لكن أفضل)
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  quantity: number;
}

export const OrderProductSchema = SchemaFactory.createForClass(OrderProduct);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  merchantId: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true, type: Object })
  customer: Record<string, any>;

  @Prop({ type: [OrderProductSchema], required: true })
  products: OrderProduct[];

  @Prop({ default: 'pending', enum: ['pending', 'paid', 'canceled'] })
  status: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
