// src/modules/scraper/scraper.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios'; // ← استيراد هذا

import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';

// إذا هناك استيراد لموديولات أخرى (ProductsModule, VectorModule, OffersModule...)
import { ProductsModule } from '../products/products.module';
import { OffersModule } from '../offers/offers.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    HttpModule, // ← أضف هنا
    BullModule.registerQueue({ name: 'scrape' }),
    forwardRef(() => ProductsModule),
    forwardRef(() => OffersModule),
    forwardRef(() => VectorModule),
  ],
  providers: [ScraperService],
  controllers: [ScraperController],
  exports: [ScraperService],
})
export class ScraperModule {}
