import { ProductsModule } from './../products/products.module';
// src/modules/offers/offers.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { ScraperModule } from '../scraper/scraper.module';
import { VectorModule } from '../vector/vector.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Merchant, MerchantSchema } from '../merchants/schemas/merchant.schema';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Product.name, schema: ProductSchema }, // ← أضف هذا السطر لحل المشكلة
      { name: Merchant.name, schema: MerchantSchema },
    ]),
    forwardRef(() => ScraperModule),
    ProductsModule,
    VectorModule,
    PlansModule,
    BullModule.registerQueue({ name: 'offer-scrape' }),
  ],
  providers: [OffersService],
  controllers: [OffersController],
  exports: [OffersService],
})
export class OffersModule {}
