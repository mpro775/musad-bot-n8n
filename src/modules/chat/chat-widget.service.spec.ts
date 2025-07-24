import { Test, TestingModule } from '@nestjs/testing';
import { ChatWidgetService } from './chat-widget.service';

describe('ChatWidgetService', () => {
  let service: ChatWidgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatWidgetService],
    }).compile();

    service = module.get<ChatWidgetService>(ChatWidgetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
