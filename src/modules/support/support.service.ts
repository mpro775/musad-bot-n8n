// src/modules/support/support.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SupportTicket,
  SupportTicketDocument,
} from './schemas/support-ticket.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectModel(SupportTicket.name)
    private readonly Ticket: Model<SupportTicketDocument>,
    private readonly http: HttpService,
  ) {}

  private generateTicketNumber() {
    // مثال: KT-9M4Z5-742
    const a = Date.now().toString(36).toUpperCase();
    const b = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, '0');
    return `KT-${a}-${b}`;
  }

  async verifyRecaptcha(token?: string) {
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret) return true; // غير مفعّل
    if (!token) return false;
    try {
      const url = 'https://www.google.com/recaptcha/api/siteverify';
      const { data } = await firstValueFrom(
        this.http.post(url, null, { params: { secret, response: token } }),
      );
      return !!data?.success;
    } catch (e) {
      this.logger.warn('reCAPTCHA verification failed');
      return false;
    }
  }

  async notifyChannels(ticket: SupportTicketDocument) {
    const title = `🎫 New Ticket: ${ticket.ticketNumber}`;
    const text = [
      `*Name:* ${ticket.name}`,
      `*Email:* ${ticket.email}`,
      ticket.phone ? `*Phone:* ${ticket.phone}` : undefined,
      `*Topic:* ${ticket.topic}`,
      `*Subject:* ${ticket.subject}`,
      `*Message:* ${ticket.message.substring(0, 500)}${ticket.message.length > 500 ? '…' : ''}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Slack
    if (process.env.SUPPORT_SLACK_WEBHOOK_URL) {
      try {
        await firstValueFrom(
          this.http.post(process.env.SUPPORT_SLACK_WEBHOOK_URL, {
            text: `${title}\n${text}`,
          }),
        );
      } catch (e) {
        this.logger.warn('Slack notify failed');
      }
    }

    // Telegram
    if (
      process.env.SUPPORT_TELEGRAM_BOT_TOKEN &&
      process.env.SUPPORT_TELEGRAM_CHAT_ID
    ) {
      try {
        const url = `https://api.telegram.org/bot${process.env.SUPPORT_TELEGRAM_BOT_TOKEN}/sendMessage`;
        await firstValueFrom(
          this.http.post(url, {
            chat_id: process.env.SUPPORT_TELEGRAM_CHAT_ID,
            text: `${title}\n${text}`,
            parse_mode: 'Markdown',
          }),
        );
      } catch (e) {
        this.logger.warn('Telegram notify failed');
      }
    }

    // n8n webhook
    if (process.env.SUPPORT_N8N_WEBHOOK_URL) {
      try {
        await firstValueFrom(
          this.http.post(process.env.SUPPORT_N8N_WEBHOOK_URL, {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            name: ticket.name,
            email: ticket.email,
            phone: ticket.phone,
            topic: ticket.topic,
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status,
            createdAt: (ticket as any).createdAt || new Date(),
          }),
        );
      } catch (e) {
        this.logger.warn('n8n notify failed');
      }
    }
  }

  async create(
    dto: CreateContactDto,
    files: Express.Multer.File[] = [],
    meta?: { ip?: string; userAgent?: string; merchantId?: string; userId?: string; source?: 'landing' | 'merchant'; },
  )  {
    if (dto.website) throw new BadRequestException('Spam detected');

    const ok = await this.verifyRecaptcha(dto.recaptchaToken);
    if (!ok) throw new BadRequestException('reCAPTCHA failed');

    const attachments = files.map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      mimeType: f.mimetype,
      size: f.size,
      url: f.path?.replace(/^\.\/|^\//, '/'), // لو تخدمها استاتيك
      storage: 'disk' as const,
    }));

    const ticketNumber = this.generateTicketNumber();

    const created = await this.Ticket.create({
        ...dto,
        ticketNumber,
        status: 'open',
        source: meta?.source || 'landing',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        attachments,
        merchantId: meta?.merchantId,
        createdBy: meta?.userId,
      });
    // إشعارات اختيارية
    this.notifyChannels(created).catch(() => undefined);

    return created;
  }
}
