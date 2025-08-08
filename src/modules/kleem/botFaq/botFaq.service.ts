// src/modules/kleem/botFaq/botFaq.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotFaq } from './schemas/botFaq.schema';
import { CreateBotFaqDto } from './dto/create-botFaq.dto';
import { v5 as uuidv5 } from 'uuid';
import { VectorService } from 'src/modules/vector/vector.service';

const BOT_FAQ_NAMESPACE = '1fa7b810-1dad-11d1-80b4-00c04fd430c8';

@Injectable()
export class BotFaqService {
  constructor(
    @InjectModel(BotFaq.name) private botFaqModel: Model<BotFaq>,
    private readonly vectorService: VectorService,
  ) {}

  generateBotFaqId(faqId: string) {
    return uuidv5(faqId, BOT_FAQ_NAMESPACE);
  }

  async create(dto: CreateBotFaqDto) {
    // 1. أضف الـFAQ في MongoDB
    const created = await this.botFaqModel.create(dto);

    // 2. جهز النص للـembedding
    const text = `${created.question}\n${created.answer}`;
    const embedding = await this.vectorService.embed(text);

    // 3. ارفع الـembedding إلى Qdrant
    await this.vectorService.upsertBotFaqs([
      {
        id: this.generateBotFaqId(created.id.toString()),
        vector: embedding,
        payload: {
          faqId: created.id,
          question: created.question,
          answer: created.answer,
          type: 'faq',
          source: created.source ?? 'manual',
        },
      },
    ]);

    return created;
  }

  async findAll() {
    return this.botFaqModel.find({ status: 'active' }).lean();
  }
  async semanticSearch(q: string, topK = 5) {
    return this.vectorService.searchBotFaqs(q, topK);
  }
  async update(id: string, dto: Partial<CreateBotFaqDto>) {
    const updated = await this.botFaqModel.findByIdAndUpdate(id, dto, {
      new: true,
    });

    // لو تم التعديل على السؤال أو الجواب، عدّل المتجه في Qdrant
    if (updated && (dto.question || dto.answer)) {
      const text = `${updated.question}\n${updated.answer}`;
      const embedding = await this.vectorService.embed(text);
      await this.vectorService.upsertBotFaqs([
        {
          id: this.generateBotFaqId(updated.id.toString()),
          vector: embedding,
          payload: {
            faqId: updated.id,
            question: updated.question,
            answer: updated.answer,
            type: 'faq',
            source: updated.source ?? 'manual',
          },
        },
      ]);
    }
    return updated;
  }

  async delete(id: string) {
    // عدّل حالة السؤال فقط
    const deleted = await this.botFaqModel.findByIdAndUpdate(
      id,
      { status: 'deleted' },
      { new: true },
    );
    // يمكنك لاحقاً حذف المتجه من Qdrant إذا رغبت (بـ delete by point id)
    return deleted;
  }
}
