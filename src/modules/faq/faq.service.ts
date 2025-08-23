// src/modules/faq/faq.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Faq } from './schemas/faq.schema';
import { VectorService } from '../vector/vector.service';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    @InjectModel(Faq.name) private faqModel: Model<Faq>,
    private vectorService: VectorService,
  ) {}

  /** إدراج جماعي: نحفظ سريعًا كـ pending ثم نُعالج في الخلفية */
  async createMany(
    merchantId: string,
    faqs: { question: string; answer: string }[],
  ) {
    if (!faqs?.length) throw new BadRequestException('No FAQs provided');

    const toInsert = faqs.map((f) => ({
      merchantId,
      question: f.question,
      answer: f.answer,
      status: 'pending' as const,
    }));

    const created = await this.faqModel.insertMany(toInsert);

    // تشغيل المعالجة في الخلفية
    this.processFaqsInBackground(
      merchantId,
      created.map((d) => d.id.toString()),
    ).catch((err) =>
      this.logger.error(
        `[createMany] background error: ${err.message}`,
        err.stack,
      ),
    );

    return {
      success: true,
      queued: created.length,
      message: 'FAQs queued for embedding',
      ids: created.map((d) => d._id),
    };
  }

  /** المعالجة الخلفية: توليد embedding ورفع إلى Qdrant وتحديث الحالة */
  private async processFaqsInBackground(merchantId: string, ids: string[]) {
    for (const id of ids) {
      const faq = await this.faqModel.findOne({ _id: id, merchantId });
      if (!faq) continue;

      try {
        const text = `${faq.question}\n${faq.answer}`;
        const embedding = await this.vectorService.embed(text);

        await this.vectorService.upsertFaqs([
          {
            id: this.vectorService.generateFaqId(faq.id.toString()),
            vector: embedding,
            payload: {
              merchantId,
              faqId: faq.id.toString(),
              question: faq.question,
              answer: faq.answer,
              type: 'faq',
              source: 'manual',
            },
          },
        ]);

        await this.faqModel.updateOne(
          { _id: faq._id },
          { status: 'completed', errorMessage: null },
        );
      } catch (e: any) {
        this.logger.error(`[processFaqs] failed for ${id}: ${e.message}`);
        await this.faqModel.updateOne(
          { _id: id },
          { status: 'failed', errorMessage: e.message || 'Embedding failed' },
        );
      }
    }
    this.logger.log(`[processFaqs] Completed batch of ${ids.length}`);
  }

  /** قائمة FAQs (افتراضي: تستثني المحذوف) */
  async list(merchantId: string, includeDeleted = false) {
    const filter: any = { merchantId };
    if (!includeDeleted) filter.status = { $ne: 'deleted' };
    return this.faqModel
      .find(filter)
      .select({
        question: 1,
        answer: 1,
        status: 1,
        errorMessage: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  /** إحصائيات الحالة لواجهة “قيد التدريب” */
  async getStatus(merchantId: string) {
    const docs = await this.faqModel.find({ merchantId }).lean();
    return {
      total: docs.length,
      pending: docs.filter((d) => d.status === 'pending').length,
      completed: docs.filter((d) => d.status === 'completed').length,
      failed: docs.filter((d) => d.status === 'failed').length,
      deleted: docs.filter((d) => d.status === 'deleted').length,
    };
  }

  /** تحديث سؤال/جواب + إعادة توليد embedding */
  async updateOne(
    merchantId: string,
    faqId: string,
    data: { question?: string; answer?: string },
  ) {
    if (!Types.ObjectId.isValid(faqId))
      throw new BadRequestException('invalid id');

    const faq = await this.faqModel.findOne({ _id: faqId, merchantId });
    if (!faq) throw new NotFoundException('faq not found');

    const question = data.question ?? faq.question;
    const answer = data.answer ?? faq.answer;

    // عيّن pending مؤقتًا حتى تعاد الفهرسة
    await this.faqModel.updateOne(
      { _id: faqId },
      { question, answer, status: 'pending', errorMessage: null },
    );

    try {
      const embedding = await this.vectorService.embed(
        `${question}\n${answer}`,
      );
      await this.vectorService.upsertFaqs([
        {
          id: this.vectorService.generateFaqId(faqId),
          vector: embedding,
          payload: {
            merchantId,
            faqId,
            question,
            answer,
            type: 'faq',
            source: 'manual',
          },
        },
      ]);
      await this.faqModel.updateOne({ _id: faqId }, { status: 'completed' });
    } catch (e: any) {
      await this.faqModel.updateOne(
        { _id: faqId },
        { status: 'failed', errorMessage: e.message || 'Embedding failed' },
      );
      throw e;
    }

    return { success: true };
  }

  /** حذف ناعم (status=deleted) */
  async softDelete(merchantId: string, faqId: string) {
    if (!Types.ObjectId.isValid(faqId))
      throw new BadRequestException('invalid id');
    const res = await this.faqModel.updateOne(
      { _id: faqId, merchantId },
      { status: 'deleted' },
    );
    if (!res.matchedCount) throw new NotFoundException('faq not found');
    return { success: true, softDeleted: true };
  }

  /** حذف نهائي (DB + Qdrant) */
  async hardDelete(merchantId: string, faqId: string) {
    if (!Types.ObjectId.isValid(faqId))
      throw new BadRequestException('invalid id');

    const faq = await this.faqModel.findOne({ _id: faqId, merchantId }).lean();
    if (!faq) throw new NotFoundException('faq not found');

    // احذف النقطة من Qdrant حسب المعرف الثابت
    await this.vectorService.deleteFaqPointByFaqId(faqId);
    await this.faqModel.deleteOne({ _id: faqId });

    return { success: true, deleted: 1 };
  }

  /** حذف كل الأسئلة (soft/hard) */
  async deleteAll(merchantId: string, hard = false) {
    if (hard) {
      await this.vectorService.deleteFaqsByFilter({
        must: [
          { key: 'merchantId', match: { value: merchantId } },
          { key: 'source', match: { value: 'manual' } },
        ],
      });
      const { deletedCount } = await this.faqModel.deleteMany({ merchantId });
      return { success: true, deleted: deletedCount ?? 0, mode: 'hard' };
    } else {
      const { modifiedCount } = await this.faqModel.updateMany(
        { merchantId, status: { $ne: 'deleted' } },
        { status: 'deleted' },
      );
      return { success: true, softDeleted: modifiedCount ?? 0, mode: 'soft' };
    }
  }
}
