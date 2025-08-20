import { Injectable, OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { ChannelsDispatcherService } from 'src/modules/webhooks/channels-dispatcher.service';

@Injectable()
export class ReplyDispatchers implements OnModuleInit {
  private ch!: amqp.Channel;
  constructor(
    private cfg: ConfigService,
    private dispatcher: ChannelsDispatcherService,
  ) {}

  async onModuleInit() {
    const url = this.cfg.get<string>('RABBIT_URL')!;
    const conn = await amqp.connect(url);
    this.ch = await conn.createChannel();

    await this.bindConsume('whatsapp.out.q', (p) => this.handle('whatsapp', p));
    await this.bindConsume('telegram.out.q', (p) => this.handle('telegram', p));
    await this.bindConsume('web.out.q', (p) => this.handle('webchat', p));
  }

  private async bindConsume(queue: string, fn: (p: any) => Promise<void>) {
    await this.ch.assertQueue(queue, { durable: true });
    this.ch.consume(
      queue,
      async (m) => {
        if (!m) return;
        try {
          const payload = JSON.parse(m.content.toString());
          await fn(payload);
          this.ch.ack(m);
        } catch (e) {
          this.ch.nack(m, false, false);
        }
      },
      { noAck: false },
    );
  }

  private async handle(channel: 'whatsapp' | 'telegram' | 'webchat', p: any) {
    const { merchantId, sessionId, text, transport } = p;
    await this.dispatcher.send(merchantId, channel, sessionId, text, transport);
  }
}
