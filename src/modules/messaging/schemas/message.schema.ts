// ---------------------------
// File: src/modules/messaging/schemas/message.schema.ts
// ---------------------------
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageSessionDocument = HydratedDocument<MessageSession>;

@Schema({ timestamps: true })
export class MessageSession {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true, enum: ['whatsapp', 'telegram', 'webchat'] })
  channel: string;
  @Prop({ type: Boolean, default: false })
  handoverToAgent: boolean;
  @Prop({
    type: [
      {
        role: {
          type: String,
          enum: ['customer', 'bot', 'agent'],
          required: true,
        },
        text: { type: String, required: true },
        timestamp: { type: Date, required: true },
        metadata: { type: Object, default: {} },
        keywords: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  messages: Array<{
    role: 'customer' | 'bot' | 'agent';
    text: string;
    timestamp: Date;
    metadata?: Record<string, any>;
    keywords?: string[];
  }>;
}

export const MessageSessionSchema =
  SchemaFactory.createForClass(MessageSession);
