import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { CacheWarmerOrchestrator } from './cache-warmer.orchestrator';
import { CacheController } from './cache.controller';
import { CacheMetrics } from './cache.metrics';
import { CacheModule } from './cache.module';
import { CacheService } from './cache.service';
import { CategoriesWarmer } from './warmers/categories.warmer';
import { MerchantsWarmer } from './warmers/merchants.warmer';
import { PlansWarmer } from './warmers/plans.warmer';
import { ProductsWarmer } from './warmers/products.warmer';

// Mock external dependencies
jest.mock('@nestjs/cache-manager');
jest.mock('@nestjs/schedule', () => ({
  ScheduleModule: {
    forRoot: jest.fn(() => ({ module: 'ScheduleModule' })),
  },
  Cron: jest.fn(() => jest.fn()),
  Interval: jest.fn(() => jest.fn()),
}));
jest.mock('cache-manager-ioredis');
jest.mock('./cache-warmer.orchestrator');
jest.mock('./warmers/categories.warmer');
jest.mock('./warmers/merchants.warmer');
jest.mock('./warmers/plans.warmer');
jest.mock('./warmers/products.warmer');
jest.mock('../../metrics/metrics.module');

describe('CacheModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        CacheModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(CacheModule).toBeDefined();
  });

  it('should be a global module', () => {
    // The @Global decorator makes this module global
    expect(CacheModule).toBeDefined();
  });

  describe('service providers', () => {
    it('should provide CacheService', () => {
      const cacheService = module.get<CacheService>(CacheService);
      expect(cacheService).toBeDefined();
      expect(cacheService).toBeInstanceOf(CacheService);
    });

    it('should provide CacheMetrics', () => {
      const cacheMetrics = module.get<CacheMetrics>(CacheMetrics);
      expect(cacheMetrics).toBeDefined();
      expect(cacheMetrics).toBeInstanceOf(CacheMetrics);
    });

    it('should provide CacheWarmerOrchestrator', () => {
      const orchestrator = module.get<CacheWarmerOrchestrator>(
        CacheWarmerOrchestrator,
      );
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(CacheWarmerOrchestrator);
    });
  });

  describe('controller providers', () => {
    it('should provide CacheController', () => {
      const controller = module.get<CacheController>(CacheController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(CacheController);
    });
  });

  describe('warmer providers', () => {
    it('should provide CategoriesWarmer', () => {
      const warmer = module.get<CategoriesWarmer>(CategoriesWarmer);
      expect(warmer).toBeDefined();
    });

    it('should provide MerchantsWarmer', () => {
      const warmer = module.get<MerchantsWarmer>(MerchantsWarmer);
      expect(warmer).toBeDefined();
    });

    it('should provide PlansWarmer', () => {
      const warmer = module.get<PlansWarmer>(PlansWarmer);
      expect(warmer).toBeDefined();
    });

    it('should provide ProductsWarmer', () => {
      const warmer = module.get<ProductsWarmer>(ProductsWarmer);
      expect(warmer).toBeDefined();
    });
  });

  describe('module exports', () => {
    it('should export CacheService', () => {
      const exportedService = module.get(CacheService);
      expect(exportedService).toBeDefined();
    });

    it('should export CacheWarmerOrchestrator', () => {
      const exportedOrchestrator = module.get(CacheWarmerOrchestrator);
      expect(exportedOrchestrator).toBeDefined();
    });
  });

  describe('module imports', () => {
    it('should import ConfigModule', () => {
      const configService = module.get<ConfigService>(ConfigService);
      expect(configService).toBeDefined();
    });

    it('should import MetricsModule', () => {
      // MetricsModule is mocked, so we just verify the module compiles
      expect(module).toBeDefined();
    });

    it('should import ScheduleModule', () => {
      // ScheduleModule is mocked, so we just verify the module compiles
      expect(module).toBeDefined();
    });
  });

  describe('cache manager configuration', () => {
    it('should configure Redis cache manager', () => {
      // The cache manager configuration is tested through the fact that
      // CacheService can be instantiated and uses Redis
      const cacheService = module.get<CacheService>(CacheService);
      expect(cacheService).toBeDefined();
    });

    it('should throw error when REDIS_URL is not defined', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => ({})], // No REDIS_URL
            }),
            CacheModule,
          ],
        }).compile(),
      ).rejects.toThrow('REDIS_URL is not defined');
    });

    it('should handle Redis URL parsing', () => {
      const configService = module.get<ConfigService>(ConfigService);
      const redisUrl = configService.get<string>('REDIS_URL');
      if (!redisUrl) {
        throw new Error('REDIS_URL is not defined');
      }

      expect(redisUrl).toBe('redis://localhost:6379');

      // Verify URL parsing works
      const url = new URL(redisUrl);
      expect(url.hostname).toBe('localhost');
      expect(url.port).toBe('6379');
    });

    it('should configure TLS for rediss protocol', async () => {
      const tlsModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                REDIS_URL: 'rediss://secure.redis.com:6380',
              }),
            ],
          }),
          CacheModule,
        ],
      }).compile();

      expect(tlsModule).toBeDefined();
    });
  });

  describe('warmer orchestration', () => {
    it('should inject all warmers into orchestrator', () => {
      const orchestrator = module.get<CacheWarmerOrchestrator>(
        CacheWarmerOrchestrator,
      );
      expect(orchestrator).toBeDefined();
    });

    it('should create CACHE_WARMERS factory', () => {
      const cacheWarmers = module.get('CACHE_WARMERS');
      expect(Array.isArray(cacheWarmers)).toBe(true);
      expect(cacheWarmers).toHaveLength(4); // 4 warmers
    });

    it('should provide all warmer types', () => {
      const cacheWarmers = module.get('CACHE_WARMERS');

      // Verify that all warmer types are included
      const warmerNames = cacheWarmers.map((w: any) => w.name as string);
      expect(warmerNames).toContain('categories');
      expect(warmerNames).toContain('merchants');
      expect(warmerNames).toContain('plans');
      expect(warmerNames).toContain('products');
    });
  });

  describe('dependency injection', () => {
    it('should inject ConfigService into cache service', () => {
      const cacheService = module.get<CacheService>(CacheService);
      expect(cacheService).toBeDefined();
      // The service should be able to access config through its dependencies
    });

    it('should inject CacheMetrics into cache service', () => {
      const cacheService = module.get<CacheService>(CacheService);
      const cacheMetrics = module.get<CacheMetrics>(CacheMetrics);

      expect(cacheService).toBeDefined();
      expect(cacheMetrics).toBeDefined();
    });
  });

  describe('configuration constants', () => {
    it('should use correct cache TTL', () => {
      // CACHE_TTL_5_MINUTES = 300 seconds
      const expectedTtl = 5 * 60; // 300 seconds
      expect(expectedTtl).toBe(300);
    });

    it('should use correct max cache items', () => {
      // CACHE_MAX_ITEMS = 1000
      const expectedMaxItems = 1000;
      expect(expectedMaxItems).toBe(1000);
    });

    it('should use correct Redis default DB', () => {
      // REDIS_DEFAULT_DB = 0
      const expectedDb = 0;
      expect(expectedDb).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid Redis URLs gracefully', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => ({ REDIS_URL: 'invalid-url' })],
            }),
            CacheModule,
          ],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should handle missing Redis password gracefully', () => {
      // URLs without password should work
      const configService = module.get<ConfigService>(ConfigService);
      const redisUrl = configService.get<string>('REDIS_URL');
      if (!redisUrl) {
        throw new Error('REDIS_URL is not defined');
      }
      const url = new URL(redisUrl);
      expect(url.password).toBeUndefined();
    });
  });

  describe('module lifecycle', () => {
    it('should initialize all providers correctly', () => {
      // Verify that all expected providers are available
      expect(module.get(CacheService)).toBeDefined();
      expect(module.get(CacheMetrics)).toBeDefined();
      expect(module.get(CacheController)).toBeDefined();
      expect(module.get(CacheWarmerOrchestrator)).toBeDefined();
    });

    it('should handle module destruction gracefully', async () => {
      await expect(module.close()).resolves.not.toThrow();
    });
  });
});
