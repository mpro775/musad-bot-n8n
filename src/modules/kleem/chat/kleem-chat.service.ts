import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';
import { BotChatsService } from '../botChats/botChats.service';
import { BotPromptService } from '../botPrompt/botPrompt.service';
import { KleemWsMessage } from '../ws/kleem-ws.types';

@Injectable()
export class KleemChatService {
  private readonly logger = new Logger(KleemChatService.name);
  private readonly n8n: AxiosInstance;

  constructor(
    private readonly chats: BotChatsService,
    private readonly prompts: BotPromptService,
    private readonly events: EventEmitter2,
  ) {
    this.n8n = axios.create({
      baseURL: 'https://n8n.kaleem-ai.com',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async handleUserMessage(
    sessionId: string,
    text: string,
    metadata?: Record<string, unknown>,
  ) {
    // 1) خزّن رسالة المستخدم
    await this.chats.createOrAppend(sessionId, [
      { role: 'user', text, metadata: metadata ?? {} },
    ]);

    // 2) بثّ للمشرفين (اختياري)
    this.events.emit('kleem.admin_new_message', {
      sessionId,
      message: { role: 'user', text } as KleemWsMessage,
    });

    // 3) اجلب الـSystem Prompt الفعّال
    const systemPrompt = await this.prompts.getActiveSystemPromptOrDefault();

    // 4) أرسل إلى n8n (بدون merchantId) مع مُعرّف البوت + البرومبت + ميتاداتا
    try {
      await this.n8n.post('/webhook-test/webhook/ai-agent', {
        bot: 'kleem', // 👈 يُعرّف أن المصدر كليم
        sessionId, // لربط الردّ بنفس الجلسة
        channel: 'webchat', // قناة كليم
        text, // نص المستخدم
        prompt: systemPrompt, // 👈 البرومبت لإعادة الاستخدام داخل n8n
        meta: metadata ?? {}, // أي بيانات إضافية (UTM, page, device...)
      });
    } catch (err) {
      this.logger.error('[n8n] failed to post user message', err as Error);
      // لا نكسر التجربة: الرد سيأتي عندما يستعيد n8n عافيته
    }

    // الرد سيصل عبر Webhook n8n -> backend (أنظر الكنترولر)
    return { status: 'queued' as const };
  }
}
