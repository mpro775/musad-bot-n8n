import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number; // قيمة الاشتراك

  @Prop({ required: true })
  duration: number; // بالأيام
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
