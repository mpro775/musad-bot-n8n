// src/modules/support/schemas/support-ticket.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContactTopic } from '../dto/create-contact.dto';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

class AttachmentMeta {
  @Prop() originalName!: string;
  @Prop() filename!: string;
  @Prop() mimeType!: string;
  @Prop() size!: number;
  @Prop() url?: string; // رابط الوصول (لو بتخدمها استاتيك)
  @Prop({ default: 'disk' }) storage!: 'disk' | 'minio';
}

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) email!: string;
  @Prop() phone?: string;

  @Prop({ required: true, enum: Object.values(ContactTopic) })
  topic!: ContactTopic;

  @Prop({ required: true }) subject!: string;
  @Prop({ required: true }) message!: string;

  @Prop({ default: 'open' }) status!:
    | 'open'
    | 'pending'
    | 'resolved'
    | 'closed';
  @Prop({ default: 'landing' }) source!: string; // landing/webchat/etc
  @Prop() ip?: string;
  @Prop() userAgent?: string;

  @Prop({ type: [AttachmentMeta], default: [] })
  attachments!: AttachmentMeta[];

  @Prop({ index: true, unique: true }) ticketNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'Merchant', index: true })
  merchantId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ createdAt: -1 });
SupportTicketSchema.index({ email: 1, createdAt: -1 });
