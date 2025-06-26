import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationDocument = Integration & Document;

@Schema({ timestamps: true })
export class Integration {
  @Prop({ required: true, index: true }) merchantId: string;

  @Prop({
    required: true,
    enum: ['zapier', 'whatsapp', 'facebook', 'instagram', 'slack'],
  })
  key: 'zapier' | 'whatsapp' | 'facebook' | 'instagram' | 'slack';

  @Prop({ default: false }) enabled: boolean;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ default: 'free' }) tier: 'free' | 'pro' | 'enterprise';
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
