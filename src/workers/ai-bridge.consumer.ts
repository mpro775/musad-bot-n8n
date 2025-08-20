// src/workers/ai-bridge.consumer.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AiBridgeConsumer {
  private readonly logger = new Logger(AiBridgeConsumer.name);
  private readonly n8nBase = process.env.N8N_BASE?.replace(/\/+$/, '')!; // e.g. https://n8n.example.com
  private readonly workerToken = process.env.WORKER_TOKEN!; // للتحقق المتبادل

  // استدعِ هذه من مستمع RabbitMQ لأي routingKey = whatsapp|telegram|webchat
  async onChatIncoming(msg: {
    merchantId: string;
    sessionId: string;
    channel: 'whatsapp' | 'telegram' | 'webchat';
    text: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await axios.post(`${this.n8nBase}/webhook/ai-agent`, msg, {
        headers: { 'X-Worker-Token': this.workerToken },
      });
    } catch (e: any) {
      this.logger.error('Failed to call n8n', e?.response?.data || e.message);
      // سياسات إعادة المحاولة حسب الـ broker
    }
  }

  // في حال أردت أيضًا استهلاك chat.reply من مصادر أخرى غير n8n
  // مرّرها إلى /webhooks/:merchantId/bot-reply أو نادِ ChannelsDispatcherService مباشرة.
}
