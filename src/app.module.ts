// src/app.module.ts

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { BullModule, BullModuleOptions } from '@nestjs/bull';

import {
  PrometheusModule,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';

import configuration from './configuration';
import { DatabaseConfigModule } from './config/database.config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { PlansModule } from './modules/plans/plans.module';
import { ScraperModule } from './modules/scraper/scraper.module';

import { RolesGuard } from './common/guards/roles.guard';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MessagingModule } from './modules/messaging/message.module';
import { RedisConfig } from './config/redis.config';
import { RedisModule } from './config/redis.module';
import { OffersModule } from './modules/offers/offers.module';
import { N8nWorkflowModule } from './modules/n8n-workflow/n8n-workflow.module';
import { WorkflowHistoryModule } from './modules/workflow-history/workflow-history.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { VectorModule } from './modules/vector/vector.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // Logger (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    // فعّل Passport و JWT هنا
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    // Config
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // Prometheus – يفتح endpoint تحت /api/metrics
    PrometheusModule.register({
      path: '/api/metrics',
    }),

    // Cache (Redis)
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      ttl: 30,
    }),

    // Scheduler
    ScheduleModule.forRoot(),
    RedisModule,

    // Bull (Redis) for queues
    BullModule.forRootAsync({
      imports: [RedisModule],
      useFactory: (config: ConfigService): BullModuleOptions => {
        const url = config.get<string>('REDIS_URL');
        if (!url) throw new Error('REDIS_URL not defined');
        const parsed = new URL(url);
        return {
          redis: {
            host: parsed.hostname,
            port: parseInt(parsed.port, 10),
            password: parsed.password || undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    // Database
    DatabaseConfigModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProductsModule,
    MessagingModule,
    MerchantsModule,
    PlansModule,
    OffersModule,
    VectorModule,
    ChatModule,
    N8nWorkflowModule,
    WorkflowHistoryModule,
    WebhooksModule,
    ScraperModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // 1) Guard للأدوار
    { provide: APP_GUARD, useClass: RolesGuard },
    RedisConfig,
    // 2) تعريف الـ histogram لقياس زمن الطلبات
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 1.5, 2, 5],
    }),

    // 3) Interceptor لجمع المقاييس على كل طلب HTTP
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
