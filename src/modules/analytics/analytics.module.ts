// src/analytics/analytics.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MessageSession,
  MessageSessionSchema,
} from '../messaging/schemas/message.schema';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ProductsModule } from '../products/products.module';
import { Merchant, MerchantSchema } from '../merchants/schemas/merchant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSession.name, schema: MessageSessionSchema },
      { name: Merchant.name, schema: MerchantSchema }, // أضف هذا السطر
    ]),
    forwardRef(() => ProductsModule),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService], // ← هذا السطر مفقود عندك
})
export class AnalyticsModule {}
