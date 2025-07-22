import { Test, TestingModule } from '@nestjs/testing';
import { PromptVersionService } from './prompt-version.service';

describe('PromptVersionService', () => {
  let service: PromptVersionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptVersionService],
    }).compile();

    service = module.get<PromptVersionService>(PromptVersionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
