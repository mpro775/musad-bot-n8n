// src/modules/products/schemas/product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true })
  originalUrl: string;

  @Prop({ default: '' })
  platform: string;

  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: [] })
  images: string[];

  @Prop({ default: '' })
  category: string;

  @Prop({ default: '' })
  lowQuantity: string;

  @Prop({ default: [] })
  specsBlock: string[];

  @Prop({ default: null })
  lastFetchedAt: Date;

  @Prop({ default: null })
  lastFullScrapedAt: Date;

  @Prop({ default: null })
  errorState: string;

  @Prop({ enum: ['manual', 'api', 'scraper'], required: true })
  source: 'manual' | 'api' | 'scraper';

  @Prop({ default: null })
  sourceUrl: string; // رابط المنتج أو API أو فارغ للمنتجات اليدوية

  @Prop({ default: null })
  externalId: string; // ID من الـ API الخارجي (إن وجد)

  @Prop({ default: 'active', enum: ['active', 'inactive', 'out_of_stock'] })
  status: string;

  @Prop({ default: null })
  lastSync: Date;

  @Prop({ default: null })
  syncStatus: 'ok' | 'error' | 'pending';

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Offer' }], default: [] })
  offers: Types.ObjectId[]; // العروض المفعلة على هذا المنتج

  @Prop({ default: [] })
  keywords: string[];
  @Prop({ unique: true, sparse: true })
  uniqueKey: string; // merchantId+originalUrl أو merchantId+externalId
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 'text', description: 'text' });
