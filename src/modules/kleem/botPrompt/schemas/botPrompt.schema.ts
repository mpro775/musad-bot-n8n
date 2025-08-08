// src/modules/kleem/botPrompt/schemas/botPrompt.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PromptType = 'system' | 'user';

@Schema({ timestamps: true })
export class BotPrompt extends Document {
  @Prop({ type: String, enum: ['system', 'user'], required: true })
  type: PromptType;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  name?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: false })
  archived: boolean;
}

export const BotPromptSchema = SchemaFactory.createForClass(BotPrompt);

// فهارس
BotPromptSchema.index({ type: 1, active: 1 });
BotPromptSchema.index({ archived: 1, updatedAt: -1 });
