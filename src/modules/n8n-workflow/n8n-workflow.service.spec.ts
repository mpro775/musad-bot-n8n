import { Test, TestingModule } from '@nestjs/testing';
import { N8nWorkflowService } from './n8n-workflow.service';

describe('N8nWorkflowService', () => {
  let service: N8nWorkflowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [N8nWorkflowService],
    }).compile();

    service = module.get<N8nWorkflowService>(N8nWorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
