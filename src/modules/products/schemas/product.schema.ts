// src/modules/products/schemas/product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Currency } from '../enums/product.enums';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  // لم تعد مطلوبة للإنشاء اليدوي
  @Prop({ type: String, default: null })
  originalUrl: string | null;

  @Prop({ default: '' })
  platform: string;

  @Prop({ required: true, trim: true, default: '' })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: [] })
  images: string[];

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  @Prop({ default: '' })
  lowQuantity?: string;

  @Prop({ default: [] })
  specsBlock: string[];

  @Prop({ type: Date, default: null })
  lastFetchedAt: Date | null;

  @Prop({ type: Date, default: null })
  lastFullScrapedAt: Date | null;

  @Prop({ type: String, default: null })
  errorState: string | null;

  @Prop({ enum: ['manual', 'api'], required: true })
  source: 'manual' | 'api';

  @Prop({ type: String, default: null })
  sourceUrl: string | null;

  @Prop({ type: String, default: null })
  externalId: string | null;

  @Prop({ default: 'active', enum: ['active', 'inactive', 'out_of_stock'] })
  status: string;

  @Prop({ type: Date, default: null })
  lastSync: Date | null;

  @Prop({ type: String, default: null })
  syncStatus: 'ok' | 'error' | 'pending' | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Offer' }], default: [] })
  offers: Types.ObjectId[];

  @Prop({ default: [] })
  keywords: string[];

  @Prop({ unique: true, sparse: true })
  uniqueKey: string;

  
  @Prop({ type: String, enum: Object.values(Currency), default: Currency.SAR })
  currency: Currency;

  @Prop({ type: Map, of: [String], default: undefined })
  attributes?: Map<string, string[]>;

  hasActiveOffer?: boolean;
  priceEffective?: number;

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      oldPrice: { type: Number },
      newPrice: { type: Number },
      startAt: { type: Date },
      endAt: { type: Date },
    },
    _id: false,
    default: undefined,
  })
  offer?: {
    enabled: boolean;
    oldPrice?: number;
    newPrice?: number;
    startAt?: Date;
    endAt?: Date;
  };

  // 👇 جديد
  @Prop({ type: String }) slug?: string;

  @Prop({ type: String, default: undefined }) // ← لا تستخدم null
  storefrontSlug?: string;

  @Prop({ type: String, default: undefined })
  storefrontDomain?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// افتراضيات قبل الحفظ
ProductSchema.pre('validate', function (next) {
  // slug يجب أن يكون موجودًا؛ لو مفقود نولّده
  if (!this.slug) {
    const rand = Math.random().toString(16).slice(2, 8);
    this.slug = `p-${rand}`;
  }
  next();
});

// مشتقات جاهزة في الاسترجاع
function computeDerived(doc: any) {
  const now = new Date();
  const ofr = doc.offer;
  let active = false;
  if (ofr?.enabled && ofr.newPrice != null && ofr.newPrice >= 0) {
    if (ofr.startAt && ofr.endAt) {
      active = now >= new Date(ofr.startAt) && now <= new Date(ofr.endAt);
    } else if (ofr.startAt && !ofr.endAt) {
      active = now >= new Date(ofr.startAt);
    } else if (!ofr.startAt && ofr.endAt) {
      active = now <= new Date(ofr.endAt);
    } else {
      active = true;
    }
  }
  doc.hasActiveOffer = !!active;
  doc.priceEffective = active ? Number(ofr.newPrice) : Number(doc.price);
}

ProductSchema.post('init', function () { computeDerived(this); });
ProductSchema.post('save', function () { computeDerived(this); });
ProductSchema.post('find', function (docs) { docs.forEach(computeDerived); });
ProductSchema.post('findOne', function (doc) { if (doc) computeDerived(doc); });
ProductSchema.index({ 'offer.enabled': 1, 'offer.startAt': 1, 'offer.endAt': 1 });
