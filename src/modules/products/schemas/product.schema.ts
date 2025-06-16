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

  @Prop({ default: [] })
  keywords: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
