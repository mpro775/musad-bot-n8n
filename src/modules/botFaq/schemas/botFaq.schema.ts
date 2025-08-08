// src/modules/botFaq/schemas/botFaq.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BotFaq extends Document {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ default: 'active' })
  status: 'active' | 'deleted';

  @Prop({ default: 'manual' })
  source: 'manual' | 'auto' | 'imported';
}

export const BotFaqSchema = SchemaFactory.createForClass(BotFaq);
