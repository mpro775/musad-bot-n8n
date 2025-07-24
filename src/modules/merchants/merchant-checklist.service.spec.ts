import { Test, TestingModule } from '@nestjs/testing';
import { MerchantChecklistService } from './merchant-checklist.service';

describe('MerchantChecklistService', () => {
  let service: MerchantChecklistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantChecklistService],
    }).compile();

    service = module.get<MerchantChecklistService>(MerchantChecklistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
