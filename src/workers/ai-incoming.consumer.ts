import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp from 'amqplib';
import axios from 'axios';

@Injectable()
export class AiIncomingConsumer implements OnModuleInit {
  private ch!: amqp.Channel;
  constructor(
    private cfg: ConfigService,
    private logger: Logger = new Logger('AiIncoming'),
  ) {}

  async onModuleInit() {
    const url = this.cfg.get<string>('RABBIT_URL')!;
    const conn = await amqp.connect(url);
    this.ch = await conn.createChannel();
    await this.ch.assertQueue('ai.reply-worker.q', { durable: true });
    this.ch.consume('ai.reply-worker.q', (m) => this.consume(m), {
      noAck: false,
    });
  }

  private async consume(m?: amqp.ConsumeMessage | null) {
    if (!m) return;
    try {
      const payload = JSON.parse(m.content.toString());
      // payload = { merchantId, sessionId, channel, text, metadata, transport? }
      await axios.post(
        process.env.N8N_BASE!.replace(/\/+$/, '') + '/webhook/ai-agent',
        payload,
        {
          headers: { 'X-Worker-Token': process.env.WORKER_TOKEN! },
        },
      );
      this.ch.ack(m);
    } catch (e) {
      this.logger.error('AI bridge failed', (e as any)?.message);
      this.ch.nack(m, false, false); // DLQ
    }
  }
}
