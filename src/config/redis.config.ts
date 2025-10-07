// src/config/redis.config.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { RedisOptions } from 'ioredis';

@Injectable()
export class RedisConfig {
  public readonly connection: RedisOptions;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) throw new Error('REDIS_URL not defined');

    const parsed = new URL(url);

    const connection: Partial<RedisOptions> = {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10),
    };

    if (parsed.username) connection.username = parsed.username;
    if (parsed.password) connection.password = parsed.password;
    if (parsed.protocol === 'rediss:') connection.tls = {};

    this.connection = connection as RedisOptions;
  }
}
