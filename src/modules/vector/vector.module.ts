// src/modules/vector/vector.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { VectorService } from './vector.service';
import { VectorController } from './vector.controller';

import { ProductsModule } from '../products/products.module';
import { OffersModule } from '../offers/offers.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => OffersModule),
  ],
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}
