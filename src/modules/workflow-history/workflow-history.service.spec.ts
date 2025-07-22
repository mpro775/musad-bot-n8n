import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowHistoryService } from './workflow-history.service';

describe('WorkflowHistoryService', () => {
  let service: WorkflowHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowHistoryService],
    }).compile();

    service = module.get<WorkflowHistoryService>(WorkflowHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
