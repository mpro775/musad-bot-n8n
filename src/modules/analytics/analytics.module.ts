import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MessageSession,
  MessageSessionSchema,
} from '../messaging/schemas/message.schema';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';
import { Stats, StatsSchema } from './schemas/stats.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { StatsService } from './stats.service';
import { AnalyticsInterceptor } from './interceptors/analytics.interceptor';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSession.name, schema: MessageSessionSchema },
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
      { name: Stats.name, schema: StatsSchema },
    ]),
    forwardRef(() => ProductsModule), // ← هنا استخدم forwardRef
    ScheduleModule.forRoot(), // لجدولة الـ Cron jobs
  ],
  providers: [AnalyticsService, StatsService, AnalyticsInterceptor],
  controllers: [AnalyticsController],
  exports: [AnalyticsService], // نصدر خدمة التحليلات لكي يستخدمها ProductsService
})
export class AnalyticsModule {}
