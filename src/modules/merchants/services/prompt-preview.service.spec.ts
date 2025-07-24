import { Test, TestingModule } from '@nestjs/testing';
import { PromptPreviewService } from './prompt-preview.service';

describe('PromptPreviewService', () => {
  let service: PromptPreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptPreviewService],
    }).compile();

    service = module.get<PromptPreviewService>(PromptPreviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
