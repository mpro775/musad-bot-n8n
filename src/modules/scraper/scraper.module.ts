// src/modules/scraper/scraper.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [
    // سجل الطابور هنا باسم "scrape"
    BullModule.registerQueue({ name: 'scrape' }),
  ],
  providers: [ScraperService],
  controllers: [ScraperController],
  exports: [ScraperService],
})
export class ScraperModule {}
