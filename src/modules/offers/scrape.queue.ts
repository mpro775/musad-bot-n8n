// src/modules/offers/scrape.queue.ts
import {
  Injectable,
  OnModuleInit,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisConfig } from '../../config/redis.config';
import { ScraperService } from '../scraper/scraper.service';
import { OffersService } from './offers.service';
import { InjectQueue } from '@nestjs/bull';

export type OfferJobData = {
  offerId: string;
  url: string;
  merchantId: string;
  mode: 'full' | 'minimal';
};

@Injectable()
export class ScrapeQueue implements OnModuleInit {
  private readonly logger = new Logger(ScrapeQueue.name);

  @InjectQueue('offer-scrape')
  private queue: Queue<OfferJobData>;

  constructor(
    private readonly redisConfig: RedisConfig,
    private readonly scraperService: ScraperService,
    @Inject(forwardRef(() => OffersService))
    private readonly offersService: OffersService,
  ) {}

  onModuleInit() {
    // تأكد أن اسم الطابور موحد مع InjectQueue
    this.queue = new Queue<OfferJobData>('offer-scrape', {
      connection: this.redisConfig.connection,
    });

    new Worker<OfferJobData>(
      'offer-scrape',
      async (job: Job<OfferJobData>) => {
        const { offerId, url, mode } = job.data;

        try {
          const result = await this.scraperService.scrapeProduct(url, { mode });

          const now = new Date();
          if (mode === 'minimal') {
            // فقط تحديث بيانات بسيطة + lastFetchedAt
            await this.offersService.updateAfterScrape(offerId, {
              price: (result as any).discount,
              description: (result as any).description,
              lastFetchedAt: now,
              errorState: '',
            });
          } else {
            // full → تحديث كامل الحقول + timestamps
            const { name, price, description, images, platform } =
              result as any;

            await this.offersService.updateAfterScrape(offerId, {
              name,
              price,
              description,
              images,
              platform,
              lastFetchedAt: now,
              lastFullScrapedAt: now,
              errorState: '',
            });
          }

          this.logger.log(`Scraped [${mode}] and updated offer ${offerId}`);
        } catch (err) {
          // عند الخطأ نسجّل الرسالة ونحدّث lastFetchedAt
          await this.offersService.updateAfterScrape(offerId, {
            errorState: (err as Error).message,
            lastFetchedAt: new Date(),
          });
          this.logger.error(
            `Failed to scrape (${mode}) offer ${offerId}: ${(err as Error).message}`,
          );
        }
      },
      {
        connection: this.redisConfig.connection,
        concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '5', 10),
      },
    );
  }

  /**
   * لإضافة مهمة إلى طابور العروض:
   * - mode 'full' عند الإنشاء أو طلب صريح
   * - mode 'minimal' للتحديث الدوري
   */
  async addJob(data: OfferJobData): Promise<void> {
    await this.queue.add('offer-scrape', data, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
