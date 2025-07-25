import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test utilities
export const createTestingModule = async (providers: any[] = [], imports: any[] = []) => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      ...imports,
    ],
    providers,
  }).compile();

  return moduleRef;
};

// Mock factories
export const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
});

export const mockModel = () => ({
  find: jest.fn().mockReturnThis(),
  findOne: jest.fn().mockReturnThis(),
  findById: jest.fn().mockReturnThis(),
  create: jest.fn(),
  save: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  lean: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
});

export const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
});

export const mockConfigService = () => ({
  get: jest.fn(),
  getOrThrow: jest.fn(),
});

export const mockCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
});

export const mockHttpService = () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
});

export const mockQueue = () => ({
  add: jest.fn(),
  process: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  clean: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
});

// Test data factories
export const createMockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashedpassword',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockRequest = (overrides = {}) => ({
  user: createMockUser(),
  headers: {},
  body: {},
  params: {},
  query: {},
  ...overrides,
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = /^[0-9a-fA-F]{24}$/.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
    }
  }
}
