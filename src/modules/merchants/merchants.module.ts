// src/modules/merchants/merchants.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Merchant, MerchantSchema } from './schemas/merchant.schema';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
    HttpModule,
  ],
  providers: [MerchantsService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
