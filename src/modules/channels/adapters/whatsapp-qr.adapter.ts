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
    // نبقي اسم instance واضحًا ومحدّدًا
    const instanceName = `whatsapp_${c.merchantId}_${c.id}`;

    // تنظيف أي جلسة قديمة بنفس الاسم
    await this.evo.deleteInstance(instanceName).catch(() => undefined);

    // ✅ ولّد توكن وأرسله عند إنشاء الجلسة
    const token = uuidv4();
    const { qr, instanceId } = await this.evo.startSession(instanceName, token);

    // اضبط Webhook على مسار القناة
    const webhookUrl = `${this.config.get('PUBLIC_WEBHOOK_BASE')}/webhooks/whatsapp_qr/${c.id}`;
    await this.evo.setWebhook(
      instanceName,
      webhookUrl,
      ['MESSAGES_UPSERT'],
      true,
      true,
    );

    // خزّن كل شيء في الوثيقة (التوكن مُشفّر)
    c.sessionId = instanceName;
    c.instanceId = instanceId;
    c.qr = qr;
    c.webhookUrl = webhookUrl;
    c.accessTokenEnc = encryptSecret(token);
    c.enabled = true;
    c.status = ChannelStatus.PENDING;
    await c.save();

    return { mode: 'qr', qr, webhookUrl };
  }

  async disconnect(c: ChannelDocument): Promise<void> {
    // حذف جلسة Evolution
    if (c.sessionId) {
      await this.evo.deleteInstance(c.sessionId).catch(() => undefined);
    }
    c.enabled = false;
    c.status = ChannelStatus.DISCONNECTED;
    await c.save();
  }

  async refresh(c: ChannelDocument): Promise<void> {
    // لا شيء خاص هنا، ممكن مستقبلاً إعادة تعيين webhook
  }

  async getStatus(c: ChannelDocument): Promise<Status> {
    if (!c.sessionId) return { status: ChannelStatus.DISCONNECTED };
    try {
      const inst = await this.evo.getStatus(c.sessionId);
      return { status: inst?.status ?? c.status, details: inst };
    } catch {
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
