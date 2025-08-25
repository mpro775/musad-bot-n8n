// src/modules/channels/adapters/whatsapp-qr.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  ChannelAdapter,
  ConnectResult,
  Status,
  WebhookResult,
} from './channel-adapter';
import { ChannelDocument, ChannelStatus } from '../schemas/channel.schema';
import { EvolutionService } from '../../integrations/evolution.service';
import { encryptSecret } from '../utils/secrets.util';

@Injectable()
export class WhatsAppQrAdapter implements ChannelAdapter {
  private readonly logger = new Logger(WhatsAppQrAdapter.name);

  constructor(
    private readonly evo: EvolutionService,
    private readonly config: ConfigService,
  ) {}

  async connect(c: ChannelDocument): Promise<ConnectResult> {
    const instanceName = `whatsapp_${c.merchantId}_${c.id}`;

    // نظّف أي جلسة قديمة بنفس الاسم (لا يضر لو ما وُجدت)
    await this.evo.deleteInstance(instanceName).catch(() => undefined);

    // أنشئ جلسة جديدة + فعّل QR
    const token = uuidv4();
    const resp: any = await this.evo.startSession(instanceName, token); // يستدعي /instance/create { qrcode:true }

    // طبع الـ QR من كل الأشكال المحتملة
    const qr: string | null =
      resp?.qr ??
      resp?.qrcode?.base64 ??
      (typeof resp?.qrcode === 'string' && resp.qrcode.startsWith('data:image/')
        ? resp.qrcode
        : null);

    const instanceId: string | undefined =
      resp?.instanceId || resp?.instance?.instanceId;

    // وحّد مسار الـ webhook: يعتمد على PUBLIC_WEBHOOK_BASE (مثلاً: https://api.example.com/api/webhooks)
    const rawBase = String(this.config.get('PUBLIC_WEBHOOK_BASE') || '').trim();
    const base = rawBase.replace(/\/+$/, ''); // شيل السلاشات آخر الرابط
    const hooksBase = /\/webhooks$/i.test(base) ? base : `${base}/webhooks`;
    const webhookUrl = `${hooksBase}/whatsapp_qr/${c.id}`;

    await this.evo
      .setWebhook(
        instanceName,
        webhookUrl,
        ['MESSAGES_UPSERT'],
        true, // sendHeaders
        true, // webhook_base64
      )
      .catch((e) => {
        this.logger.warn(`setWebhook failed: ${e?.message || e}`);
      });

    // خزّن الأساسيات
    c.sessionId = instanceName;
    c.instanceId = instanceId;
    if (qr) (c as any).qr = qr; // لو السكيمة ستركت، يتجاهلها بدون كسر
    c.webhookUrl = webhookUrl;
    c.accessTokenEnc = encryptSecret(token);
    c.enabled = true;
    c.status = ChannelStatus.PENDING;
    await c.save();

    return { mode: 'qr', qr: qr || '', webhookUrl };
  }

  async disconnect(c: ChannelDocument): Promise<void> {
    if (c.sessionId) {
      await this.evo.deleteInstance(c.sessionId).catch(() => undefined);
    }
    c.enabled = false;
    c.status = ChannelStatus.DISCONNECTED;
    await c.save();
  }

  async refresh(c: ChannelDocument): Promise<void> {
    // مستقبلاً: إعادة ضبط الـ webhook لو لزم
    return;
  }

  async getStatus(c: ChannelDocument): Promise<Status> {
    if (!c.sessionId) return { status: ChannelStatus.DISCONNECTED };

    try {
      const inst: any = await this.evo.getStatus(c.sessionId);
      const raw = String(inst?.status || '').toLowerCase();

      // خرّط الحالات الشائعة من Evolution إلى حالاتنا الموحدة
      const mapped: ChannelStatus =
        raw === 'connected' || raw === 'open' || raw === 'authenticated'
          ? ChannelStatus.CONNECTED
          : raw === 'disconnected' || raw === 'closed'
            ? ChannelStatus.DISCONNECTED
            : ChannelStatus.PENDING; // created / waiting_qr / connecting ...

      return { status: mapped, details: inst };
    } catch (e) {
      this.logger.warn(
        `getStatus failed: ${e instanceof Error ? e.message : e}`,
      );
      return { status: c.status };
    }
  }

  async sendMessage(c: ChannelDocument, to: string, text: string) {
    if (!c.sessionId) throw new Error('WhatsApp QR not configured');
    await this.evo.sendMessage(c.sessionId, to, text);
  }

  async handleWebhook(): Promise<WebhookResult> {
    return { ok: true };
  }
}
