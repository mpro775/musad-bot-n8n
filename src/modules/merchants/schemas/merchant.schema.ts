// src/merchants/schemas/merchant.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { buildPromptFromMerchant } from '../utils/prompt-builder';

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

  @Prop({ required: false })
  storefrontUrl?: string;

  @Prop({ required: false })
  logoUrl?: string;

  @Prop({ type: AddressSchema, default: () => ({}) })
  address: Address;

  @Prop({ type: SubscriptionPlanSchema, required: true })
  subscription: SubscriptionPlan;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ required: false, unique: true, sparse: true })
  domain?: string;

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
      telegram: ChannelConfigSchema,
      webchat: ChannelConfigSchema,
    },
    default: {},
  })
  channels: {
    whatsapp?: ChannelConfig;
    telegram?: ChannelConfig;
    webchat?: ChannelConfig;
  };

  // — Working hours —
  @Prop({ type: [WorkingHourSchema], default: [] })
  workingHours: WorkingHour[];
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);

MerchantSchema.pre<MerchantDocument>('save', function (next) {
  if (
    this.isNew ||
    this.isModified('quickConfig') ||
    this.isModified('currentAdvancedConfig.template') ||
    this.isModified('advancedConfigHistory') ||
    this.isModified('returnPolicy') ||
    this.isModified('exchangePolicy') ||
    this.isModified('shippingPolicy')
  ) {
    this.finalPromptTemplate = buildPromptFromMerchant(this);
  }
  next();
});
