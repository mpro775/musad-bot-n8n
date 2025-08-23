// src/modules/knowledge/knowledge.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { chromium } from 'playwright';
import { VectorService } from '../vector/vector.service';
import { SourceUrl } from './schemas/source-url.schema';

function isUsefulChunk(text: string): boolean {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount >= 3;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  constructor(
    @InjectModel(SourceUrl.name)
    private readonly sourceUrlModel: Model<SourceUrl>,
    private readonly vectorService: VectorService,
  ) {}

  async addUrls(merchantId: string, urls: string[]) {
    const records = await this.sourceUrlModel.insertMany(
      urls.map((url) => ({ merchantId, url, status: 'pending' })),
    );

    this.processUrlsInBackground(merchantId, records).catch((error) => {
      this.logger.error(`Background processing failed: ${error.message}`);
    });

    return { success: true, count: records.length, message: 'URLs queued for processing' };
  }

  private async processUrlsInBackground(merchantId: string, records: any[]) {
    for (let index = 0; index < records.length; index++) {
      const rec = records[index];
      this.logger.log(`Processing URL ${index + 1}/${records.length}: ${rec.url}`);

      try {
        const { text } = await this.extractTextFromUrl(rec.url);
        this.logger.log(`Extracted ${text.length} characters from ${rec.url}`);

        const chunks = text.match(/.{1,1000}/gs) ?? [];
        this.logger.log(`Split into ${chunks.length} chunks`);

        let processedChunks = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i].trim();
          if (chunk.length < 30) {
            this.logger.log(`Skipping chunk ${i}: too short (${chunk.length} chars)`);
            continue;
          }
          if (!isUsefulChunk(chunk)) {
            this.logger.log(`Skipping chunk ${i}: not useful`);
            continue;
          }

          this.logger.log(`Embedding chunk ${i}...`);
          const embedding = await this.vectorService.embed(chunk);

          await this.vectorService.upsertWebKnowledge([{
            id: this.vectorService.generateWebKnowledgeId(
              merchantId,
              `${rec.url}#${i}`,
            ),
            vector: embedding,
            payload: {
              merchantId,
              url: rec.url,
              text: chunk,
              type: 'url',
              source: 'web',
            },
          }]);

          processedChunks++;
        }

        this.logger.log(`Processed ${processedChunks} chunks for ${rec.url}`);

        await this.sourceUrlModel.updateOne(
          { _id: rec._id },
          { status: 'completed', textExtracted: text },
        );
      } catch (e: any) {
        this.logger.error(`Failed to process ${rec.url}: ${e.message}`, e.stack);
        await this.sourceUrlModel.updateOne(
          { _id: rec._id },
          { status: 'failed', errorMessage: e.message },
        );
      }
    }

    this.logger.log(`Completed processing all URLs`);
    return { success: true, count: records.length };
  }

  async getUrlsStatus(merchantId: string) {
    const urls = await this.sourceUrlModel.find({ merchantId });
    return {
      total: urls.length,
      pending: urls.filter((u) => u.status === 'pending').length,
      completed: urls.filter((u) => u.status === 'completed').length,
      failed: urls.filter((u) => u.status === 'failed').length,
      urls: urls.map((u) => ({
        id: String(u._id),
        url: u.url,
        status: u.status,
        errorMessage: u.errorMessage,
        textLength: u.textExtracted?.length || 0,
      })),
    };
  }

  async getUrls(merchantId: string) {
    return this.sourceUrlModel
      .find({ merchantId })
      .select({ _id: 1, url: 1, status: 1, errorMessage: 1, createdAt: 1 })
      .lean();
  }

  async extractTextFromUrl(url: string): Promise<{ text: string }> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();
    return { text };
  }

  // ===========================
  //        دوال الحذف
  // ===========================

  /** حذف بسجل Mongo _id (مع حذف متجهاته من Qdrant) */
  async deleteById(merchantId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('invalid id');

    const rec = await this.sourceUrlModel.findOne({ _id: id, merchantId });
    if (!rec) throw new NotFoundException('record not found');

    await this.deleteVectorsByUrl(merchantId, rec.url);
    await this.sourceUrlModel.deleteOne({ _id: rec._id });

    return { success: true, deleted: 1, url: rec.url };
  }

  /** حذف برابط URL صريح */
  async deleteByUrl(merchantId: string, url: string) {
    const rec = await this.sourceUrlModel.findOne({ merchantId, url });
    if (!rec) throw new NotFoundException('url not found');

    await this.deleteVectorsByUrl(merchantId, url);
    await this.sourceUrlModel.deleteOne({ _id: rec._id });

    return { success: true, deleted: 1, url };
  }

  /** حذف كل روابط هذا التاجر + كل متجهاتها */
  async deleteAll(merchantId: string) {
    const urls = await this.sourceUrlModel.find({ merchantId }).lean();

    // حذف كل نقاط هذا التاجر من web_knowledge
    await this.vectorService.deleteWebKnowledgeByFilter({
      must: [
        { key: 'merchantId', match: { value: merchantId } },
        { key: 'source', match: { value: 'web' } },
      ],
    });

    const { deletedCount } = await this.sourceUrlModel.deleteMany({ merchantId });
    return { success: true, deleted: deletedCount ?? 0, urls: urls.length };
  }

  /** أداة مساعدة: حذف كل نقاط رابط واحد */
  private async deleteVectorsByUrl(merchantId: string, url: string) {
    await this.vectorService.deleteWebKnowledgeByFilter({
      must: [
        { key: 'merchantId', match: { value: merchantId } },
        { key: 'url', match: { value: url } },
        { key: 'source', match: { value: 'web' } },
      ],
    });
  }
}
