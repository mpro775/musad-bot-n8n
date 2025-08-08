// src/merchants/schemas/merchant.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { QuickConfig, QuickConfigSchema } from './quick-config.schema';
import { AdvancedConfig, AdvancedConfigSchema } from './advanced-config.schema';
import { ChannelConfig, ChannelConfigSchema } from './channel.schema';
import { WorkingHour, WorkingHourSchema } from './working-hours.schema';
import { Address, AddressSchema } from './address.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './subscription-plan.schema';

export interface MerchantDocument extends Merchant, Document {
  createdAt: Date;
  updatedAt: Date;
}
@Schema({ timestamps: true })
export class Merchant {
  // — Core fields —
  @Prop({ required: true, unique: true })
  name: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  skippedChecklistItems: string[];

  @Prop({ required: false })
  logoUrl?: string;

  @Prop({
    type: {
      salla: {
        active: { type: Boolean, default: false },
        accessToken: { type: String },
        refreshToken: { type: String },
        storeId: { type: String },
        storeUrl: { type: String },
        lastSync: { type: Date },
      },
      zid: {
        active: { type: Boolean, default: false },
        accessToken: { type: String },
        refreshToken: { type: String },
        storeId: { type: String },
        storeUrl: { type: String },
        lastSync: { type: Date },
      },
      // لو أردت دعم مصادر أخرى مستقبلاً
    },
    default: {},
  })
  integrations: {
    salla?: {
      active: boolean;
      accessToken?: string;
      refreshToken?: string;
      storeId?: string;
      clientId?: string;
      clientSecret?: string;
      storeUrl?: string;
      lastSync?: Date;
      redirectUri?: string;
    };
  };
  @Prop({
    type: {
      accessToken: String,
      refreshToken: String,
      storeId: String,
      tokenType: String,
      expiresIn: Number,
      lastSync: Date,
    },
    default: {},
  })
  zidIntegration?: {
    accessToken: string;
    refreshToken: string;
    storeId: string;
    tokenType?: string;
    expiresIn?: number;
    lastSync?: Date;
  };
  @Prop({ enum: ['internal', 'salla', 'zid'], default: 'internal' })
  productSource: 'internal' | 'salla' | 'zid';

  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];
  @Prop({ type: Map, of: String, default: {} })
  socialLinks?: { [key: string]: string };

  @Prop({ type: SubscriptionPlanSchema, required: true })
  subscription: SubscriptionPlan;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ required: false })
  customCategory?: string; // ← الفئة التي يضيفها التاجر بنفسه عند اختيار "أخرى"

  @Prop({ required: false })
  businessType?: string;

  @Prop({ required: false })
  businessDescription?: string;

  @Prop({ required: false })
  workflowId?: string;

  // — Prompt settings —
  @Prop({ type: QuickConfigSchema, default: () => ({}) })
  quickConfig: QuickConfig;

  @Prop({ type: AdvancedConfigSchema, default: () => ({}) })
  currentAdvancedConfig: AdvancedConfig;
  @Prop({
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  })
  status: string;

  @Prop({ default: '' })
  phone: string;

  @Prop()
  lastActivity?: Date;
  @Prop({ type: [AdvancedConfigSchema], default: [] })
  advancedConfigHistory: AdvancedConfig[];

  @Prop({ default: '' })
  finalPromptTemplate: string;

  // — Policy documents —
  @Prop({ default: '' })
  returnPolicy: string;

  @Prop({ default: '' })
  exchangePolicy: string;

  @Prop({ default: '' })
  shippingPolicy: string;

  // — Channels —
  @Prop({
    type: {
      whatsapp: ChannelConfigSchema,
      whatsappQr: ChannelConfigSchema, // لدعم QR إذا أردت الفصل
      telegram: ChannelConfigSchema,
      webchat: ChannelConfigSchema,
      instagram: ChannelConfigSchema,
      messenger: ChannelConfigSchema,
    },
    default: {},
  })
  channels: {
    whatsapp?: ChannelConfig;
    whatsappQr?: ChannelConfig;
    telegram?: ChannelConfig;
    webchat?: ChannelConfig;
    instagram?: ChannelConfig;
    messenger?: ChannelConfig;
  };

  @Prop({ type: Array, default: [] })
  leadsSettings?: any[];

  @Prop({ type: Types.ObjectId, ref: 'Storefront' })
  storefront?: Types.ObjectId;
  // — Working hours —
  @Prop({ type: [WorkingHourSchema], default: [] })
  workingHours: WorkingHour[];
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
