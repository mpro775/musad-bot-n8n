// src/modules/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import MinioStorage from 'multer-minio-storage-engine'; // ✅ الصحيح
import { MulterModule } from '@nestjs/platform-express';

import { DocumentSchemaClass, DocumentSchema } from './schemas/document.schema';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessor } from './processors/document.processor';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentSchemaClass.name, schema: DocumentSchema },
    ]),
    BullModule.registerQueue({ name: 'documents-processing-queue' }),

    MulterModule.register({
      storage: MinioStorage({
        minio: {
          endPoint: process.env.MINIO_ENDPOINT!,
          port: Number(process.env.MINIO_PORT ?? '9000'),
          useSSL: process.env.MINIO_USE_SSL === 'true',
          accessKey: process.env.MINIO_ACCESS_KEY!,
          secretKey: process.env.MINIO_SECRET_KEY!,
        },
        bucketName: process.env.MINIO_BUCKET || 'documents', // ✅ استخدم bucketName بدل bucket
        contentType: (_req: any, file: Express.Multer.File): string => {
          return file.mimetype;
        },
        key: (_req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
    VectorModule, // ✅ أضف هذا هنا
  ],
  providers: [DocumentsService, DocumentProcessor],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
