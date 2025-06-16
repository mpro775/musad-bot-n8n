// src/modules/merchants/schemas/merchant.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { buildPromptFromMerchant } from '../utils/prompt-builder';

export type MerchantDocument = Merchant & Document;

@Schema({ timestamps: true })
export class Merchant {
  @Prop({ required: true })
  name: string;
  @Prop() workflowId: string; // رابط الورك فلو الخاص به في n8n

  @Prop({ required: false, unique: true, sparse: true })
  email?: string;

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

  @Prop({ default: 'free' })
  planName: string;

  @Prop({ default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) })
  trialEndsAt: Date;

  @Prop({ default: false })
  planPaid: boolean;

  // هنا قمنا بتعريف البنية لتطابق updateData exactly:
  @Prop({
    type: {
      whatsapp: { phone: String },
      telegram: { chatId: String, token: String },
    },
    _id: false,
  })
  channelConfig?: {
    telegram?: { token: string; chatId: string };
    whatsapp?: { token: string; phone: string };
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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: false })
  businessType?: string;

  @Prop({ required: false })
  businessDescription?: string;

  @Prop({ default: 'formal' })
  preferredDialect: string;
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
MerchantSchema.pre<MerchantDocument>('save', function (next) {
  // إذا تغيرت الـ name أو الـ promptConfig أو الحقل جديد
  if (
    this.isNew ||
    this.isModified('name') ||
    this.isModified('promptConfig')
  ) {
    this.finalPromptTemplate = buildPromptFromMerchant(this);
  }
  next();
});
