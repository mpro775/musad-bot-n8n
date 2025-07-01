import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { VectorService } from '../vector/vector.service';
import * as XLSX from 'xlsx';
import { join } from 'path';

@Injectable()
export class ProductsImportService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly vectorService: VectorService,
  ) {}

  async importFromFile(filePath: string, merchantId: string) {
    const absPath = join(process.cwd(), filePath);
    const workbook = XLSX.readFile(absPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const merchantObjectId = new Types.ObjectId(merchantId);

    const productDocs = await Promise.all(
      rows.map(async (row: any) => {
        const product = await this.productModel.create({
          merchantId: merchantObjectId,
          name: row.name ?? '',
          description: row.description ?? '',
          category: row.category ?? '',
          price: parseFloat(row.price || 0),
          isAvailable: true,
          images: row.images?.split(',') ?? [],
          specsBlock: row.specsBlock?.split(',') ?? [],
          keywords: row.keywords?.split(',') ?? [],
          source: 'manual',
          status: 'active',
          originalUrl: null,
          sourceUrl: null,
          externalId: null,
          syncStatus: 'imported',
        });

        return {
          id: product._id.toString(),
          merchantId: merchantId,
          name: product.name,
          description: product.description,
          category: product.category,
          specsBlock: product.specsBlock,
          keywords: product.keywords,
        };
      }),
    );

    await this.vectorService.upsertProducts(productDocs);

    return {
      count: productDocs.length,
      message: 'Products imported successfully',
    };
  }
}
