import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });
});
