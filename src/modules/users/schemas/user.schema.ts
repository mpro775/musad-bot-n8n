// src/modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: true })
  firstLogin: boolean;

  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({
    type: String,
    enum: ['MERCHANT', 'ADMIN', 'MEMBER'],
    default: 'MEMBER',
  })
  role: 'MERCHANT' | 'ADMIN' | 'MEMBER';

  // حقل رابط للـ Merchant (اختياريّ لأنه قد يكون ليس كل User تاجرًا)
  @Prop({ type: Types.ObjectId, ref: 'Merchant' })
  merchantId?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
