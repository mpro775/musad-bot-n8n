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
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  MissingResponse,
  MissingResponseSchema,
} from './schemas/missing-response.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSession.name, schema: MessageSessionSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: MissingResponse.name, schema: MissingResponseSchema },

      { name: Merchant.name, schema: MerchantSchema }, // أضف هذا السطر
    ]),
    forwardRef(() => ProductsModule),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService], // ← هذا السطر مفقود عندك
})
export class AnalyticsModule {}
