// src/modules/offers/offers.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { ScraperModule } from '../scraper/scraper.module';
import { ScrapeQueue } from './scrape.queue';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    forwardRef(() => ScraperModule),
    BullModule.registerQueue({ name: 'offer-scrape' }), // طابور خاص بالعروض
  ],
  providers: [OffersService, ScrapeQueue], // نسخ ScrapeQueue مع تغيير الاسم داخله إن احتاجت
  controllers: [OffersController],
  exports: [OffersService],
})
export class OffersModule {}
