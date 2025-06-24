import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class AdvancedConfig {
  @Prop({ required: true, default: '' })
  template: string;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop()
  note?: string;
}

export type AdvancedConfigDocument = AdvancedConfig & Document;
export const AdvancedConfigSchema =
  SchemaFactory.createForClass(AdvancedConfig);
