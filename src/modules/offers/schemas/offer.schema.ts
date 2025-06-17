// src/modules/offers/schemas/offer.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type OfferDocument = HydratedDocument<Offer>;

@Schema({ timestamps: true })
export class Offer {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    enum: ['percent', 'fixed', 'bogo', 'coupon', 'custom'],
  })
  type: 'percent' | 'fixed' | 'bogo' | 'coupon' | 'custom';

  @Prop()
  value: number; // نسبة أو مبلغ (للخصم)

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  products: Types.ObjectId[]; // المنتجات المرتبطة بهذا العرض

  @Prop({ default: null })
  category: string; // يمكن الربط بفئة بدل منتج (اختياري)

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: null })
  code: string; // إذا كان العرض كوبون

  @Prop({ default: 0 })
  usageLimit: number; // أقصى عدد مرات استخدام

  @Prop({ default: 0 })
  usedCount: number; // عدد مرات الاستخدام الفعلي

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  meta: Record<string, any>;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
