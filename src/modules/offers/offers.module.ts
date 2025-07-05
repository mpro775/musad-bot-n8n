// src/modules/offers/offers.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';

import { Offer, OfferSchema } from './schemas/offer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';

import { ScraperModule } from '../scraper/scraper.module';
import { ProductsModule } from '../products/products.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    forwardRef(() => ScraperModule),
    forwardRef(() => ProductsModule), // ← wrap here
    forwardRef(() => VectorModule), // ← and here
    BullModule.registerQueue({ name: 'offer-scrape' }),
  ],
  providers: [OffersService],
  controllers: [OffersController],
  exports: [OffersService],
})
export class OffersModule {}
