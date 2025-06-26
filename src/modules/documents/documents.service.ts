// src/modules/documents/documents.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Client as MinioClient } from 'minio';
import {
  DocumentDocument,
  DocumentSchemaClass,
} from './schemas/document.schema';

@Injectable()
export class DocumentsService {
  private minio: MinioClient;

  constructor(
    @InjectModel(DocumentSchemaClass.name)
    private readonly docModel: Model<DocumentDocument>,
    @InjectQueue('documents-processing-queue')
    private readonly queue: Queue,
  ) {
    this.minio = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  async uploadFile(
    merchantId: string,
    file: Express.Multer.File & { key: string },
  ) {
    const doc = await this.docModel.create({
      merchantId,
      filename: file.originalname,
      fileType: file.mimetype,
      storageKey: file.key, // الآن file.key موجود بنوع string
      status: 'pending',
    });
    await this.queue.add('process', { docId: doc.id.toString(), merchantId });
    return doc.toObject();
  }
  async list(merchantId: string) {
    return this.docModel.find({ merchantId }).sort({ createdAt: -1 }).lean();
  }

  async getPresignedUrl(merchantId: string, docId: string) {
    const doc = await this.docModel.findOne({ _id: docId, merchantId }).lean();
    if (!doc) throw new NotFoundException('Document not found');
    const expires = 24 * 60 * 60; // ساعة واحدة
    return this.minio.presignedUrl(
      'GET',
      process.env.MINIO_BUCKET!,
      doc.storageKey,
      expires,
    );
  }

  async delete(merchantId: string, docId: string) {
    const doc = await this.docModel.findOne({ _id: docId, merchantId });
    if (!doc) throw new NotFoundException('Document not found');
    // حذف من MinIO
    await this.minio.removeObject(process.env.MINIO_BUCKET!, doc.storageKey);
    await this.docModel.deleteOne({ _id: docId }).exec();
  }
}
