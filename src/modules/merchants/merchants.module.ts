// src/modules/merchants/merchants.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Merchant, MerchantSchema } from './schemas/merchant.schema';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { HttpModule } from '@nestjs/axios';
import { N8nWorkflowModule } from '../n8n-workflow/n8n-workflow.module';
import { AuthModule } from '../auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
    forwardRef(() => AuthModule),
    MulterModule.register({ dest: './uploads' }),

    HttpModule,
    forwardRef(() => N8nWorkflowModule),
  ],
  providers: [MerchantsService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
