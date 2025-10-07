import { type ExecutionContext, ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { IdempotencyGuard } from './idempotency.guard';

import type { Redis } from 'ioredis';

describe('IdempotencyGuard', () => {
  let guard: IdempotencyGuard;
  let redis: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockRedis = {
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyGuard,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    guard = module.get<IdempotencyGuard>(IdempotencyGuard);
    redis = module.get('default_IORedisModuleConnectionToken');

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };

      mockContext = {
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => mockRequest),
        })),
      } as any;
    });

    describe('Missing or invalid idempotency key', () => {
      it('should allow access when no idempotency key header', async () => {
        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).not.toHaveBeenCalled();
      });

      it('should allow access when idempotency key is empty', async () => {
        mockRequest.headers['idempotency-key'] = '';

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).not.toHaveBeenCalled();
      });

      it('should allow access when idempotency key is too short', async () => {
        mockRequest.headers['idempotency-key'] = 'short';

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).not.toHaveBeenCalled();
      });

      it('should allow access when idempotency key is exactly minimum length', async () => {
        mockRequest.headers['idempotency-key'] = 'a'.repeat(16);

        redis.set.mockResolvedValue('OK');

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
          'idemp:' + 'a'.repeat(16),
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });
    });

    describe('Valid idempotency key scenarios', () => {
      beforeEach(() => {
        redis.set.mockResolvedValue('OK');
      });

      it('should allow access for new idempotency key', async () => {
        mockRequest.headers['idempotency-key'] = 'valid-key-12345';

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
          'idemp:valid-key-12345',
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should use correct Redis key format', async () => {
        const testKey = 'test-idempotency-key';
        mockRequest.headers['idempotency-key'] = testKey;

        await guard.canActivate(mockContext);

        expect(redis.set).toHaveBeenCalledWith(
          `idemp:${testKey}`,
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should set TTL to 24 hours', async () => {
        mockRequest.headers['idempotency-key'] = 'test-key';

        await guard.canActivate(mockContext);

        expect(redis.set).toHaveBeenCalledWith(
          'idemp:test-key',
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should handle array idempotency key header', async () => {
        mockRequest.headers['idempotency-key'] = ['test-key'];

        await guard.canActivate(mockContext);

        expect(redis.set).toHaveBeenCalledWith(
          'idemp:test-key',
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });
    });

    describe('Duplicate key scenarios', () => {
      it('should throw ConflictException for duplicate idempotency key', async () => {
        mockRequest.headers['idempotency-key'] = 'duplicate-key';

        redis.set.mockResolvedValue(null); // NX operation failed (key exists)

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          new ConflictException('duplicate idempotency-key'),
        );

        expect(redis.set).toHaveBeenCalledWith(
          'idemp:duplicate-key',
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should provide consistent error message', async () => {
        mockRequest.headers['idempotency-key'] = 'duplicate-key';

        redis.set.mockResolvedValue(null);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          new ConflictException('duplicate idempotency-key'),
        );
      });
    });

    describe('Redis interaction', () => {
      beforeEach(() => {
        mockRequest.headers['idempotency-key'] = 'test-key';
      });

      it('should call Redis set with correct parameters', async () => {
        redis.set.mockResolvedValue('OK');

        await guard.canActivate(mockContext);

        expect(redis.set).toHaveBeenCalledWith(
          'idemp:test-key',
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should handle Redis errors gracefully', async () => {
        redis.set.mockRejectedValue(new Error('Redis connection failed'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Redis connection failed',
        );
      });

      it('should handle Redis timeout', async () => {
        redis.set.mockImplementation(() => new Promise(() => {})); // Never resolves

        const timeoutPromise = guard.canActivate(mockContext);

        // Should eventually timeout or throw
        await expect(timeoutPromise).rejects.toThrow();
      });
    });

    describe('Edge cases', () => {
      it('should handle malformed request object', async () => {
        mockContext.switchToHttp = jest.fn(() => ({
          getRequest: jest.fn(() => null),
        })) as any;

        await expect(guard.canActivate(mockContext)).rejects.toThrow();
      });

      it('should handle request without headers', async () => {
        const requestWithoutHeaders = {} as any;
        mockContext.switchToHttp = jest.fn(() => ({
          getRequest: jest.fn(() => requestWithoutHeaders),
        })) as any;

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
      });

      it('should handle very long idempotency keys', async () => {
        const longKey = 'a'.repeat(1000);
        mockRequest.headers['idempotency-key'] = longKey;

        redis.set.mockResolvedValue('OK');

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
          `idemp:${longKey}`,
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should handle idempotency keys with special characters', async () => {
        const specialKey = 'key-with-!@#$%^&*()_+{}|:<>?[]\\;\'",./-symbols';
        mockRequest.headers['idempotency-key'] = specialKey;

        redis.set.mockResolvedValue('OK');

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
          `idemp:${specialKey}`,
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });

      it('should handle idempotency keys with Unicode characters', async () => {
        const unicodeKey = 'key-with-unicode-🚀-字符';
        mockRequest.headers['idempotency-key'] = unicodeKey;

        redis.set.mockResolvedValue('OK');

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
          `idemp:${unicodeKey}`,
          '1',
          'EX',
          60 * 60 * 24,
          'NX',
        );
      });
    });

    describe('Integration scenarios', () => {
      it('should work correctly in a typical API scenario', async () => {
        mockRequest.headers['idempotency-key'] = 'test-request-id';

        redis.set.mockResolvedValue('OK');

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
      });

      it('should handle duplicate request correctly', async () => {
        mockRequest.headers['idempotency-key'] = 'duplicate-request';

        redis.set.mockResolvedValue(null); // Duplicate

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          new ConflictException('duplicate idempotency-key'),
        );
      });
    });

    describe('Performance considerations', () => {
      it('should handle rapid successive calls', async () => {
        mockRequest.headers['idempotency-key'] = 'performance-test';

        redis.set.mockResolvedValue('OK');

        const results: boolean[] = [];
        for (let i = 0; i < 100; i++) {
          results.push(await guard.canActivate(mockContext));
        }

        expect(results).toHaveLength(100);
        expect(results.every((result) => result === true)).toBe(true);
      });
    });

    describe('Guard properties and methods', () => {
      it('should be a proper guard implementation', () => {
        expect(guard).toBeInstanceOf(Object);
        expect(typeof guard.canActivate).toBe('function');
      });

      it('should have access to Redis client', () => {
        expect(guard['redis']).toBeDefined();
        expect(guard['redis']).toBeInstanceOf(Object);
      });
    });

    describe('Async behavior', () => {
      it('should return Promise<boolean>', async () => {
        mockRequest.headers['idempotency-key'] = 'async-test';

        redis.set.mockResolvedValue('OK');

        const result = guard.canActivate(mockContext);

        expect(result).toBeInstanceOf(Promise);

        const resolvedResult = await result;
        expect(resolvedResult).toBe(true);
      });

      it('should handle Promise rejection correctly', async () => {
        mockRequest.headers['idempotency-key'] = 'error-test';

        redis.set.mockRejectedValue(new Error('Redis error'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Redis error',
        );
      });
    });
  });
});
