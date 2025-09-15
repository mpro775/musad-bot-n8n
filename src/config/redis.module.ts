// src/config/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { RedisModule as IORedisModule } from '@nestjs-modules/ioredis';
import { RedisConfig } from './redis.config';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ConfigModule,
    IORedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL'),
        options: {
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RedisConfig],
  exports: [RedisConfig, IORedisModule],
})
export class RedisModule {}
