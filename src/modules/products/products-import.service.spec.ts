import { Test, TestingModule } from '@nestjs/testing';
import { ProductsImportService } from './products-import.service';

describe('ProductsImportService', () => {
  let service: ProductsImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsImportService],
    }).compile();

    service = module.get<ProductsImportService>(ProductsImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
