// src/modules/products/scrape.queue.ts
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
import { ProductsService } from './products.service';
import { InjectQueue } from '@nestjs/bull';

type ScrapeJobData = {
  productId: string;
  url: string;
  mode: 'full' | 'minimal';
};

@Injectable()
export class ScrapeQueue implements OnModuleInit {
  private readonly logger = new Logger(ScrapeQueue.name);
  @InjectQueue('scrape')
  private queue: Queue<ScrapeJobData>;

  constructor(
    private readonly redisConfig: RedisConfig,
    private readonly scraperService: ScraperService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
  ) {}

  onModuleInit() {
    // تأكد أن اسم القوّة موحد مع InjectQueue
    this.queue = new Queue<ScrapeJobData>('scrape', {
      connection: this.redisConfig.connection,
    });

    new Worker<ScrapeJobData>(
      'scrape',
      async (job: Job<ScrapeJobData>) => {
        const { productId, url, mode } = job.data;

        try {
          // تمرير الخيار mode إلى service
          const result = await this.scraperService.scrapeProduct(url, { mode });

          const now = new Date();
          if (mode === 'minimal') {
            // فقط تحديث السعر والتوفر + lastFetchedAt
            await this.productsService.updateAfterScrape(productId, {
              price: (result as any).price,
              isAvailable: (result as any).isAvailable,
              lastFetchedAt: now,
              errorState: '',
            });
          } else {
            // full → نحدّث كل الحقول + lastFetchedAt + lastFullScrapedAt
            const {
              name,
              price,
              isAvailable,
              images,
              description,
              category,
              lowQuantity,
              specsBlock,
              platform,
            } = result as any;

            await this.productsService.updateAfterScrape(productId, {
              name,
              price,
              isAvailable: isAvailable,
              images,
              description,
              category,
              lowQuantity,
              specsBlock,
              platform,
              lastFetchedAt: now,
              lastFullScrapedAt: now,
              errorState: '',
            });
          }

          this.logger.log(`Scraped [${mode}] and updated product ${productId}`);
        } catch (err) {
          // عند الخطأ نُسجّل الرسالة ونحدّث lastFetchedAt
          await this.productsService.updateAfterScrape(productId, {
            errorState: (err as Error).message,
            lastFetchedAt: new Date(),
          });
          this.logger.error(
            `Failed to scrape (${mode}) product ${productId}: ${(err as Error).message}`,
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
   * لإضافة مهمة إلى الطابور:
   * mode: 'full' عند الإضافة الأولى أو طلب صريح
   * mode: 'minimal' للتحديث الدوري
   */
  async addJob(data: ScrapeJobData) {
    await this.queue.add('scrape', data, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
