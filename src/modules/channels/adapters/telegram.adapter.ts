// src/modules/channels/adapters/telegram.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChannelAdapter, ConnectResult, Status, WebhookResult } from './channel-adapter';
import { ChannelDocument } from '../schemas/channel.schema';
import { decryptSecret, encryptSecret } from '../utils/secrets.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  private readonly logger = new Logger(TelegramAdapter.name);
  constructor(private readonly http: HttpService, private readonly config: ConfigService) {}

  async connect(c: ChannelDocument, payload?: { botToken: string }): Promise<ConnectResult> {
    if (!payload?.botToken) throw new Error('botToken is required');
    const hookUrl = `${this.config.get('PUBLIC_WEBHOOK_BASE')}/webhooks/telegram/${c.id}`;
    await firstValueFrom(this.http.get(
      `https://api.telegram.org/bot${payload.botToken}/setWebhook`,
      {
       params: {
         url: hookUrl,
         secret_token: this.config.get('TELEGRAM_WEBHOOK_SECRET'),
         drop_pending_updates: true,         // يقلل الضجيج عند التبديل
         allowed_updates: JSON.stringify(['message','edited_message']) // اختياري
       }
      }
    ));
    c.webhookUrl = hookUrl;
    c.botTokenEnc = encryptSecret(payload.botToken);
    c.enabled = true; c.status = 'connected' as any;
    await c.save();
    return { mode: 'webhook', webhookUrl: hookUrl };
  }
  async disconnect(c: ChannelDocument, mode: 'disable'|'disconnect'|'wipe' = 'disconnect'): Promise<void> {
    try {
     if (c.botTokenEnc) {
       const token = decryptSecret(c.botTokenEnc);
        await firstValueFrom(
          this.http.get(`https://api.telegram.org/bot${token}/deleteWebhook`, {
            params: { drop_pending_updates: 'true' },
          }),
        );
      }
    } catch (e) {
      this.logger.warn(`Telegram deleteWebhook failed: ${e?.message}`);
    }
   c.status = 'disconnected' as any;
   c.enabled = false;
   if (mode === 'wipe') {
     c.botTokenEnc = undefined;
     c.webhookUrl = undefined;
   }
   await c.save();
  }
  
  async refresh(): Promise<void> { /* no-op for Telegram */ }
  async getStatus(c: ChannelDocument): Promise<Status> { return { status: c.status, details: { webhookUrl: c.webhookUrl } }; }
   async sendMessage(c: ChannelDocument, to: string, text: string) {
       const token = c.botTokenEnc ? decryptSecret(c.botTokenEnc) : undefined;
       if (!token) throw new Error('Telegram not configured');
       await firstValueFrom(
         this.http.post(`https://api.telegram.org/bot${token}/sendMessage`, {
           chat_id: to,
           text,
           // parse_mode: 'HTML', // لو تحب تدعم تنسيق
         })
       );
     } 
  async handleWebhook(): Promise<WebhookResult> { return { ok: true }; }
}