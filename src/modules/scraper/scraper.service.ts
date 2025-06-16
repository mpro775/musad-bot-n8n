// src/scraper/scraper.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { chromium, Page } from 'playwright';
import { zidSelectors } from './selectors-config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';

type MinimalResult = { price: number; isAvailable: boolean };
type FullResult = {
  platform: string;
  name: string;
  price: number;
  isAvailable: boolean;
  images: string[];
  description: string;
  category: string;
  lowQuantity: string;
  specsBlock: string[];
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(@InjectQueue('scrape') private readonly scraperQueue: Queue) {}
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleMinimalScrape() {
    this.logger.debug('Enqueue minimal scrape');
    await this.scraperQueue.add('scrape', { mode: 'minimal' });
  }

  @Cron(CronExpression.EVERY_WEEK)
  async scheduleFullScrape() {
    this.logger.debug('Enqueue weekly full scrape');
    await this.scraperQueue.add('scrape', { mode: 'full' });
  }

  private async trySelectors(page: Page, selectors: string[]): Promise<string> {
    for (const sel of selectors) {
      try {
        await page.waitForFunction(
          (s) => !!document.querySelector(s)?.textContent?.trim(),
          sel,
          { timeout: 5_000 },
        );
        const txt = (await page.textContent(sel))?.trim() ?? '';
        if (txt) return txt;
      } catch {
        // تجاهل الخطأ وجرب selector آخر
      }
    }
    return '';
  }

  private async tryImageSelectors(
    page: Page,
    selectors: string[],
  ): Promise<string[]> {
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5_000 });
        const imgs = await page.$$eval(sel, (els) =>
          (els as HTMLImageElement[])
            .map((img) => img.src)
            .filter((src) => src && !src.includes('placeholder')),
        );
        if (imgs.length) return imgs;
      } catch {
        // تجاهل الخطأ
      }
    }
    return [];
  }

  async scrapeProduct(
    rawUrl: string,
    options: { mode: 'full' | 'minimal' } = { mode: 'full' },
  ): Promise<MinimalResult | FullResult> {
    // 1) تحقق من صحّة الرابط
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      // 2) اذهب إلى الصفحة
      await page.goto(url.toString(), {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });

      // 3) الوضع minimal
      if (options.mode === 'minimal') {
        const priceTxt = await this.trySelectors(page, zidSelectors.price);
        const price = parseFloat(priceTxt.replace(/[^\d.]/g, '')) || 0;

        const lowQty = await this.trySelectors(page, zidSelectors.lowQuantity);
        const isAvailable = !/نفد/i.test(lowQty);

        return { price, isAvailable };
      }

      // 4) الوضع full — استخلص كل حقل بأمان
      const platform = 'zid';

      // فئة
      let category = '';
      try {
        category =
          (await page.getAttribute(zidSelectors.category[0], 'content')) ?? '';
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }

      // الاسم والإصدار
      let name = '';
      let variant = '';
      try {
        name = await this.trySelectors(page, zidSelectors.name);
        variant = await this.trySelectors(page, zidSelectors.variant);
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }
      const fullName = variant ? `${name} – ${variant}` : name;

      // السعر
      let price = 0;
      try {
        const priceTxt = await this.trySelectors(page, zidSelectors.price);
        price = parseFloat(priceTxt.replace(/[^\d.]/g, '')) || 0;
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }
      // الوصف
      let description = '';
      try {
        description = await this.trySelectors(page, zidSelectors.description);
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }
      // الصور
      let images: string[] = [];
      try {
        images = await this.tryImageSelectors(page, zidSelectors.images);
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }
      // التوفر
      let lowQuantity = '';
      let isAvailable = true;
      try {
        lowQuantity = await this.trySelectors(page, zidSelectors.lowQuantity);
        isAvailable = !/نفد/i.test(lowQuantity);
      } catch (err) {
        this.logger.debug(`selector failed: ${err.message}`);
      }

      // مواصفات
      let specsBlock: string[] = [];
      try {
        specsBlock = await page.$$eval(zidSelectors.specsBlock[0], (els) =>
          (els as HTMLSpanElement[])
            .map((s) => s.textContent?.trim() ?? '')
            .filter(Boolean),
        );
      } catch (err) {
        // no-op: بعض المواقع قد لا يكون لها selector المناسب
        this.logger.debug(`selector failed: ${err.message}`);
      }

      return {
        platform,
        name: fullName,
        price,
        isAvailable,
        images,
        description,
        category,
        lowQuantity,
        specsBlock,
      };
    } catch (err) {
      this.logger.error(`Error scraping ${rawUrl}: ${(err as Error).message}`);
      // إذا فشل التنقل أو حدث خطأ غير متوقع
      throw new InternalServerErrorException('Failed to scrape product');
    } finally {
      if (browser) await browser.close();
    }
  }
}
