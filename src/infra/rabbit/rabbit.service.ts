import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Connection, Channel } from 'amqplib';

@Injectable()
export class RabbitService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(RabbitService.name);
  private conn: Connection;
  private ch: Channel;
  private url: string;
  private connecting = false;

  constructor(private cfg: ConfigService) {
    this.url = this.cfg.get<string>('RABBIT_URL')!;
    this.connect().catch(() => {}); // kick off
  }
  private async connect(retryMs = 3000): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    for (;;) {
      try {
        this.conn = await amqp.connect(this.url);
        this.ch = await this.conn.createChannel();
        this.conn.on('close', () => this.reconnect());
        this.conn.on('error', () => this.reconnect());
        this.logger.log('Rabbit connected');
        break;
      } catch (e) {
        this.logger.warn(
          `Rabbit connect failed: ${e}. retrying in ${retryMs}ms`,
        );
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }
    this.connecting = false;
  }

  private reconnect() {
    this.logger.warn('Rabbit connection lost, reconnecting…');
    this.conn = undefined;
    this.ch = undefined;
    this.connect().catch(() => {});
  }

  async onModuleInit() {
    const url =
      this.cfg.get<string>('RABBIT_URL') || 'amqp://guest:guest@rabbitmq:5672';
    this.conn = await amqp.connect(url);
    this.ch = await this.conn.createConfirmChannel();

    // Exchanges (topic) — من المخطط اللي اتفقنا عليه
    const exchanges = [
      'chat.incoming',
      'chat.reply',
      'knowledge.index',
      'commerce.sync',
      'webhook.dispatch',
      'analytics.events',
    ];
    for (const ex of exchanges) {
      await this.ch.assertExchange(ex, 'topic', { durable: true });
    }
    this.logger.log('RabbitMQ connected & exchanges asserted');
  }

  async publish(exchange: string, routingKey: string, message: any) {
    const buf = Buffer.from(JSON.stringify(message));
    await this.ch.publish(exchange, routingKey, buf, {
      contentType: 'application/json',
      persistent: true,
    });
    await this.ch.waitForConfirms();
  }

  async onModuleDestroy() {
    try {
      await this.ch?.close();
    } catch (err) {
      this.logger.error('Failed to close RabbitMQ channel', err);
    }
    try {
      await this.conn?.close();
    } catch (err) {
      this.logger.error('Failed to close RabbitMQ connection', err);
    }
  }
}
