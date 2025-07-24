import { Test, TestingModule } from '@nestjs/testing';
import { ProductSetupConfigService } from './product-setup-config.service';

describe('ProductSetupConfigService', () => {
  let service: ProductSetupConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductSetupConfigService],
    }).compile();

    service = module.get<ProductSetupConfigService>(ProductSetupConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
