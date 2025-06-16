import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksModule } from './webhooks.module';

describe('WebhooksModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [WebhooksModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });
});
