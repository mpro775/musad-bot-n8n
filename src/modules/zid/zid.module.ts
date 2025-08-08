import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { ZidController } from './zid.controller';

// Services
import { ZidService } from './zid.service';

// Schemas
import { Merchant, MerchantSchema } from '../merchants/schemas/merchant.schema';

// Import related modules
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';

/**
 * Zid Module
 *
 * هذا الموديول يتعامل مع كل ما يتعلق بـ Zid API:
 * - OAuth المصادقة
 * - جلب البيانات (منتجات، طلبات)
 * - معالجة Webhooks
 * - مزامنة البيانات
 */
@Module({
  imports: [
    // HTTP client للتواصل مع Zid API
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 10000,
        maxRedirects: 5,
      }),
    }),

    // Mongoose models
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),

    // Import related modules with forwardRef to avoid circular dependencies
    forwardRef(() => ProductsModule),
    forwardRef(() => OrdersModule),

    // Config module for environment variables
    ConfigModule,
  ],

  controllers: [ZidController],

  providers: [ZidService],

  exports: [ZidService],
})
export class ZidModule {}
