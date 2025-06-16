// src/modules/offers/schemas/offer.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OfferDocument = HydratedDocument<Offer>;

@Schema({ timestamps: true })
export class Offer {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true })
  originalUrl: string;

  @Prop({ default: '' })
  name: string; // بدل name

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  price: number; // بدل price

  @Prop({ default: [] })
  images: string[];

  @Prop({ default: '' })
  platform: string;

  @Prop({ default: null })
  lastFetchedAt: Date;

  @Prop({ default: null })
  lastFullScrapedAt: Date;

  @Prop({ default: null })
  errorState: string;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
