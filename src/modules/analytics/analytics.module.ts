import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MessageSession,
  MessageSessionSchema,
} from '../messaging/schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSession.name, schema: MessageSessionSchema },
    ]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
