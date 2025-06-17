// src/modules/merchants/schemas/merchant.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { buildPromptFromMerchant } from '../utils/prompt-builder';

export type MerchantDocument = Merchant & Document;

@Schema({ timestamps: true })
export class Merchant {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: [] })
  categories?: string[];
  @Prop({ required: false, unique: true, sparse: true })
  email?: string;

  planName: string;
  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  whatsappNumber?: string;

  @Prop({ required: false })
  webhookUrl?: string; // ← أضفناه لكي تُخزّن قيمة الـ webhookUrl
  @Prop({ required: false })
  storeurl?: string;
  @Prop({ required: false })
  logoUrl?: string;

  @Prop({ required: false })
  address?: string;

  @Prop({ enum: ['trial', 'active', 'banned'], default: 'trial' })
  status: 'trial' | 'active' | 'banned';

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' })
  plan: Types.ObjectId;

  @Prop({ default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) })
  trialEndsAt: Date;

  @Prop({ default: false })
  planPaid: boolean;

  @Prop({
    type: Object,
    default: {},
  })
  channels?: {
    whatsapp?: {
      phone?: string;
      webhookUrl?: string;
      token?: string;
      enabled?: boolean;
    };
    telegram?: {
      botToken?: string;
      chatId?: string;
      webhookUrl?: string;
      enabled?: boolean;
    };
    webchat?: {
      enabled?: boolean;
      widgetSettings?: Record<string, any>;
    };
    // SMS, Messenger, إلخ ...
  };
  // هنا قمنا بتعريف البنية لتطابق updateData exactly:
  @Prop({
    type: {
      whatsapp: { phone: String },
      telegram: { chatId: String, token: String },
    },
    _id: false,
  })
  channelConfig?: {
    telegram?: { chatId?: string; token?: string };
    whatsapp?: { phone?: string };
  };

  @Prop({ required: false })
  apiToken?: string;

  @Prop({ required: false })
  finalPromptTemplate: string;
  @Prop({
    type: {
      dialect: { type: String, default: 'خليجي' },
      tone: { type: String, default: 'ودّي' },
      template: { type: String, default: '' },
    },
    _id: false,
  })
  promptConfig?: {
    dialect: string;
    tone: string;
    template: string;
  };

  @Prop({ default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
  subscriptionExpiresAt: Date;

  // سياسات المتجر:
  @Prop({ required: false })
  returnPolicy?: string; // سياسة الإرجاع

  @Prop({ required: false })
  exchangePolicy?: string; // سياسة الاستبدال

  @Prop({ required: false })
  shippingPolicy?: string; // سياسة الشحن والتوصيل

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: false })
  businessType?: string;

  @Prop({ required: false })
  businessDescription?: string;
  @Prop() workflowId: string; // رابط الورك فلو الخاص به في n8n

  @Prop({ default: 'formal' })
  preferredDialect: string;
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
MerchantSchema.pre<MerchantDocument>('save', function (next) {
  if (
    this.isNew ||
    this.isModified('name') ||
    this.isModified('promptConfig') ||
    this.isModified('returnPolicy') ||
    this.isModified('exchangePolicy') ||
    this.isModified('shippingPolicy')
  ) {
    this.finalPromptTemplate = buildPromptFromMerchant(this);
  }
  next();
});
