import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { VectorController } from './vector.controller';
import { HttpModule } from '@nestjs/axios';
import { ProductsService } from '../products/products.service';
import { OffersService } from '../offers/offers.service';

@Module({
  imports: [
    HttpModule, // ← أضف هذا
    // … بقية الوحدات
  ],
  providers: [VectorService, ProductsService, OffersService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}
