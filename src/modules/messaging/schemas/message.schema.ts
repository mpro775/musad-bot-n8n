import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageSessionDocument = MessageSession & Document;

@Schema({ timestamps: true })
export class MessageSession {
  @Prop({ required: true })
  merchantId: string;

  @Prop({ required: true })
  sessionId: string; // مثلاً رقم الهاتف أو session hash

  @Prop({ required: true })
  channel: string; // 'whatsapp' | 'telegram' | 'webchat'

  @Prop({
    type: [
      {
        role: { type: String, enum: ['customer', 'bot'], required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, required: true },
        metadata: { type: Object, default: {} },
      },
    ],
    default: [],
  })
  messages: {
    role: 'customer' | 'bot';
    text: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }[];
}

export const MessageSessionSchema =
  SchemaFactory.createForClass(MessageSession);
