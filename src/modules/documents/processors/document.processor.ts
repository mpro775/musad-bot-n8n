import { Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentSchemaClass } from '../schemas/document.schema';
import { DocumentsService } from '../documents.service';
import { VectorService } from '../../vector/vector.service';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
interface DocumentJobData {
  docId: string;
  merchantId: string;
}
async function downloadFromMinioToTemp(minio, key: string): Promise<string> {
  const tempFile = join(tmpdir(), `${Date.now()}-${key}`);
  const stream = await minio.getObject(process.env.MINIO_BUCKET!, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  await fs.writeFile(tempFile, Buffer.concat(chunks));
  return tempFile;
}
@Processor('documents-processing-queue')
export class DocumentProcessor {
  constructor(
    private readonly docsSvc: DocumentsService,
    @InjectModel(DocumentSchemaClass.name)
    private readonly docModel: Model<DocumentSchemaClass>,
    private readonly vectorService: VectorService,
  ) {}

  // 🔄 override required method
  async process(job: Job<DocumentJobData>): Promise<void> {
    const { docId } = job.data;
    console.log('DocumentProcessor started job', job.data);

    // ✅ تحديث الحالة إلى "جاري المعالجة"
    await this.docModel
      .findByIdAndUpdate(docId, { status: 'processing' })
      .exec();

    try {
      const doc = await this.docModel.findById(docId).lean();
      if (!doc) throw new Error('Document not found');

      const filePath = await downloadFromMinioToTemp(
        this.docsSvc.minio,
        doc.storageKey,
      );
      let text = '';

      if (doc.fileType === 'application/pdf') {
        const buffer = readFileSync(filePath);
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        const workbook = XLSX.readFile(filePath);
        for (const sheetName of workbook.SheetNames) {
          text += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]) + '\n';
        }
      }

      const chunks: string[] = text.match(/.{1,1000}/gs) ?? [];

      const qdrantClient = (this.vectorService as any).qdrant;
      const collection = (this.vectorService as any).collection;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.vectorService.embed(chunk);
        await qdrantClient.upsert(collection, {
          wait: true,
          points: [
            {
              id: `${docId}-${i}`,
              vector: embedding,
              payload: {
                merchantId: doc.merchantId,
                documentId: docId,
                text: chunk,
              },
            },
          ],
        });
      }

      await this.docModel
        .findByIdAndUpdate(docId, { status: 'completed' })
        .exec();
    } catch (error: any) {
      await this.docModel
        .findByIdAndUpdate(docId, {
          status: 'failed',
          errorMessage: error.message,
        })
        .exec();
    }
  }
}
