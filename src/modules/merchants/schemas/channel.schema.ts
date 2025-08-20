import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class ChannelConfig {
  @Prop({ default: false })
  enabled: boolean;

  // عام
  @Prop() webhookUrl?: string;
  @Prop({ type: Object, default: {} }) widgetSettings?: Record<string, any>;

  // Telegram
  @Prop() token?: string; // Bot token
  @Prop() chatId?: string; // default chatId (اختياري)

  // WhatsApp (QR / Evolution)
  @Prop() sessionId?: string;
  @Prop() instanceId?: string;
  @Prop() qr?: string;
  @Prop() status?: string;
  @Prop() phone?: string; // رقم التاجر (اختياري - لـ عرض UI)

  // WhatsApp Cloud API (Meta)
  @Prop() accessToken?: string;
  @Prop() appSecret?: string;
  @Prop() verifyToken?: string;
  @Prop() phoneNumberId?: string;
  @Prop() wabaId?: string;
}

export type ChannelConfigDocument = ChannelConfig & Document;
export const ChannelConfigSchema = SchemaFactory.createForClass(ChannelConfig);
