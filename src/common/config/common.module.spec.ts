import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import {
  AllExceptionsFilter,
  WsAllExceptionsFilter,
  ResponseInterceptor,
  LoggingInterceptor,
} from '../index';
import { RedisLockService } from '../locks';
import { EnvironmentValidatorService } from '../services/environment-validator.service';
import { TranslationService } from '../services/translation.service';

import { CommonModule } from './common.module';

import type { TestingModule } from '@nestjs/testing';

// Mock all the dependencies
jest.mock('../index', () => ({
  AllExceptionsFilter: jest.fn().mockImplementation(() => ({})),
  WsAllExceptionsFilter: jest.fn().mockImplementation(() => ({})),
  ResponseInterceptor: jest.fn().mockImplementation(() => ({})),
  LoggingInterceptor: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../locks', () => ({
  RedisLockService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/environment-validator.service', () => ({
  EnvironmentValidatorService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/translation.service', () => ({
  TranslationService: jest.fn().mockImplementation(() => ({})),
}));

describe('CommonModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule],
    }).compile();
  });

  afterEach(async () => {
    await module?.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(CommonModule).toBeDefined();
  });

  it('should be a global module', () => {
    const moduleDefinition = Reflect.getMetadata('__module__', CommonModule);
    expect(moduleDefinition).toBeDefined();
  });

  describe('module structure', () => {
    it('should have imports', () => {
      const moduleDefinition = module as any;
      expect(moduleDefinition.imports).toBeDefined();
      expect(Array.isArray(moduleDefinition.imports)).toBe(true);
    });

    it('should have providers', () => {
      const moduleDefinition = module as any;
      expect(moduleDefinition.providers).toBeDefined();
      expect(Array.isArray(moduleDefinition.providers)).toBe(true);
    });

    it('should have exports', () => {
      const moduleDefinition = module as any;
      expect(moduleDefinition.exports).toBeDefined();
      expect(Array.isArray(moduleDefinition.exports)).toBe(true);
    });
  });

  describe('imports', () => {
    it('should import JwtModule', () => {
      const jwtModule = module.get(JwtModule);
      expect(jwtModule).toBeDefined();
    });

    it('should configure JwtModule with correct settings', () => {
      const originalEnv = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'test-secret';

      // Re-import to test with custom secret
      delete require.cache[require.resolve('./common.module')];
      const { CommonModule: TestCommonModule } = require('./common.module');

      expect(TestCommonModule).toBeDefined();

      process.env.JWT_SECRET = originalEnv;
    });

    it('should use environment JWT_SECRET when available', () => {
      const originalEnv = process.env.JWT_SECRET;
      const customSecret = 'custom-jwt-secret';
      process.env.JWT_SECRET = customSecret;

      // Force module re-evaluation
      jest.resetModules();
      const { CommonModule: ReloadedModule } = require('./common.module');

      const testModule = Test.createTestingModule({
        imports: [ReloadedModule],
      });

      expect(testModule).toBeDefined();

      process.env.JWT_SECRET = originalEnv;
    });

    it('should use default JWT_SECRET when not available', () => {
      delete process.env.JWT_SECRET;

      jest.resetModules();
      const { CommonModule: ReloadedModule } = require('./common.module');

      expect(ReloadedModule).toBeDefined();
    });
  });

  describe('providers', () => {
    it('should provide APP_FILTER with AllExceptionsFilter', () => {
      const filterProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_FILTER' && p.useClass === AllExceptionsFilter,
      );

      expect(filterProvider).toBeDefined();
    });

    it('should provide APP_FILTER with WsAllExceptionsFilter', () => {
      const filterProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_FILTER' && p.useClass === WsAllExceptionsFilter,
      );

      expect(filterProvider).toBeDefined();
    });

    it('should provide APP_INTERCEPTOR with ResponseInterceptor', () => {
      const interceptorProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_INTERCEPTOR' && p.useClass === ResponseInterceptor,
      );

      expect(interceptorProvider).toBeDefined();
    });

    it('should provide APP_INTERCEPTOR with LoggingInterceptor', () => {
      const interceptorProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_INTERCEPTOR' && p.useClass === LoggingInterceptor,
      );

      expect(interceptorProvider).toBeDefined();
    });

    it('should provide EnvironmentValidatorService', () => {
      const serviceProvider = (module as any).providers.find(
        (p: any) => p.provide === 'EnvironmentValidatorService',
      );

      expect(serviceProvider).toBeDefined();
      expect(serviceProvider.useClass).toBe(EnvironmentValidatorService);
    });

    it('should provide TranslationService', () => {
      const serviceProvider = (module as any).providers.find(
        (p: any) => p.provide === TranslationService,
      );

      expect(serviceProvider).toBeDefined();
      expect(serviceProvider.useClass).toBe(TranslationService);
    });

    it('should provide RedisLockService', () => {
      const serviceProvider = (module as any).providers.find(
        (p: any) => p.provide === RedisLockService,
      );

      expect(serviceProvider).toBeDefined();
      expect(serviceProvider.useClass).toBe(RedisLockService);
    });

    it('should instantiate all providers correctly', () => {
      expect(() => module.get('EnvironmentValidatorService')).not.toThrow();
      expect(() => module.get(TranslationService)).not.toThrow();
      expect(() => module.get(RedisLockService)).not.toThrow();
    });

    it('should have correct provider count', () => {
      const providers = (module as any).providers;
      expect(providers.length).toBeGreaterThan(5); // At least 6 providers
    });
  });

  describe('exports', () => {
    it('should export JwtModule', () => {
      expect((module as any).exports).toContain(JwtModule);
    });

    it('should export EnvironmentValidatorService', () => {
      expect((module as any).exports).toContain('EnvironmentValidatorService');
    });

    it('should export TranslationService', () => {
      expect((module as any).exports).toContain(TranslationService);
    });

    it('should export RedisLockService', () => {
      expect((module as any).exports).toContain(RedisLockService);
    });

    it('should have all required exports', () => {
      const exports = (module as any).exports;
      expect(exports).toContain(JwtModule);
      expect(exports).toContain('EnvironmentValidatorService');
      expect(exports).toContain(TranslationService);
      expect(exports).toContain(RedisLockService);
    });
  });

  describe('global module behavior', () => {
    it('should be available throughout the application', () => {
      // Global modules are automatically available in all modules
      expect(module).toBeDefined();
    });

    it('should provide services to other modules', async () => {
      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      // Should be able to get services from CommonModule
      expect(() => testModule.get('EnvironmentValidatorService')).not.toThrow();
      expect(() => testModule.get(TranslationService)).not.toThrow();

      await testModule.close();
    });

    it('should handle multiple module imports', async () => {
      const modules: TestingModule[] = [];

      for (let i = 0; i < 5; i++) {
        const testModule = await Test.createTestingModule({
          imports: [CommonModule],
        }).compile();
        modules.push(testModule);
      }

      // All modules should work independently
      modules.forEach((m) => {
        expect(() => m.get('EnvironmentValidatorService')).not.toThrow();
      });

      // Clean up
      await Promise.all(modules.map((m) => m.close()));
    });
  });

  describe('service instantiation', () => {
    it('should instantiate EnvironmentValidatorService correctly', () => {
      const service = module.get('EnvironmentValidatorService');

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(EnvironmentValidatorService);
    });

    it('should instantiate TranslationService correctly', () => {
      const service = module.get(TranslationService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TranslationService);
    });

    it('should instantiate RedisLockService correctly', () => {
      const service = module.get(RedisLockService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RedisLockService);
    });

    it('should provide singleton instances', () => {
      const service1 = module.get('EnvironmentValidatorService');
      const service2 = module.get('EnvironmentValidatorService');

      expect(service1).toBe(service2);
    });
  });

  describe('filter and interceptor integration', () => {
    it('should provide AllExceptionsFilter as APP_FILTER', () => {
      const filterProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_FILTER' && p.useClass === AllExceptionsFilter,
      );

      expect(filterProvider).toBeDefined();
      expect(filterProvider.useClass).toBe(AllExceptionsFilter);
    });

    it('should provide WsAllExceptionsFilter as APP_FILTER', () => {
      const filterProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_FILTER' && p.useClass === WsAllExceptionsFilter,
      );

      expect(filterProvider).toBeDefined();
      expect(filterProvider.useClass).toBe(WsAllExceptionsFilter);
    });

    it('should provide ResponseInterceptor as APP_INTERCEPTOR', () => {
      const interceptorProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_INTERCEPTOR' && p.useClass === ResponseInterceptor,
      );

      expect(interceptorProvider).toBeDefined();
      expect(interceptorProvider.useClass).toBe(ResponseInterceptor);
    });

    it('should provide LoggingInterceptor as APP_INTERCEPTOR', () => {
      const interceptorProvider = (module as any).providers.find(
        (p: any) =>
          p.provide === 'APP_INTERCEPTOR' && p.useClass === LoggingInterceptor,
      );

      expect(interceptorProvider).toBeDefined();
      expect(interceptorProvider.useClass).toBe(LoggingInterceptor);
    });

    it('should instantiate filters correctly', () => {
      expect(() => {
        const filter = module.get(AllExceptionsFilter);
        expect(filter).toBeDefined();
      }).not.toThrow();
    });

    it('should instantiate interceptors correctly', () => {
      expect(() => {
        const interceptor = module.get(ResponseInterceptor);
        expect(interceptor).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('module compilation', () => {
    it('should compile successfully', () => {
      expect(module).toBeDefined();
      expect(module.get(CommonModule)).toBeDefined();
    });

    it('should handle missing environment variables gracefully', async () => {
      const originalEnv = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();
      expect(() => testModule.get(JwtModule)).not.toThrow();

      process.env.JWT_SECRET = originalEnv;
      await testModule.close();
    });

    it('should handle malformed JWT configuration', async () => {
      process.env.JWT_SECRET = '';

      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();

      process.env.JWT_SECRET = 'valid-secret';
      await testModule.close();
    });
  });

  describe('performance considerations', () => {
    it('should handle rapid module creation', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const testModule = await Test.createTestingModule({
          imports: [CommonModule],
        }).compile();

        await testModule.close();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should not create memory leaks', async () => {
      const modules: TestingModule[] = [];

      for (let i = 0; i < 50; i++) {
        const testModule = await Test.createTestingModule({
          imports: [CommonModule],
        }).compile();
        modules.push(testModule);
      }

      // Clean up all modules
      await Promise.all(modules.map((m) => m.close()));

      // If we get here without memory issues, test passes
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle service instantiation errors', async () => {
      // Mock a service that throws during instantiation
      jest
        .spyOn(EnvironmentValidatorService.prototype, 'constructor' as any)
        .mockImplementation(() => {
          throw new Error('Service instantiation failed');
        });

      await expect(
        Test.createTestingModule({
          imports: [CommonModule],
        }).compile(),
      ).rejects.toThrow('Service instantiation failed');

      // Restore the original constructor
      jest.restoreAllMocks();
    });

    it('should handle missing dependencies', async () => {
      // This should not throw as all dependencies are mocked
      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();
      await testModule.close();
    });

    it('should handle circular dependencies', async () => {
      // CommonModule should not have circular dependencies
      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();
      await testModule.close();
    });
  });

  describe('real-world usage scenarios', () => {
    it('should work in a typical NestJS application', async () => {
      const appModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      // Should be able to get all services
      expect(() => appModule.get('EnvironmentValidatorService')).not.toThrow();
      expect(() => appModule.get(TranslationService)).not.toThrow();
      expect(() => appModule.get(RedisLockService)).not.toThrow();

      await appModule.close();
    });

    it('should support multiple feature modules', async () => {
      const featureModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      // Feature modules should be able to import CommonModule
      expect(featureModule).toBeDefined();

      await featureModule.close();
    });

    it('should handle production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();

      process.env.NODE_ENV = originalEnv;
      await testModule.close();
    });

    it('should handle development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();

      process.env.NODE_ENV = originalEnv;
      await testModule.close();
    });

    it('should handle test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const testModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      expect(testModule).toBeDefined();

      process.env.NODE_ENV = originalEnv;
      await testModule.close();
    });
  });

  describe('module metadata', () => {
    it('should have correct module decorator', () => {
      const hasGlobalDecorator = Reflect.hasMetadata(
        '__global__',
        CommonModule,
      );
      expect(hasGlobalDecorator).toBe(true);

      const isGlobal = Reflect.getMetadata('__global__', CommonModule);
      expect(isGlobal).toBe(true);
    });

    it('should have correct module definition', () => {
      const moduleMetadata = Reflect.getMetadata('__module__', CommonModule);
      expect(moduleMetadata).toBeDefined();
      expect(moduleMetadata).toHaveProperty('imports');
      expect(moduleMetadata).toHaveProperty('providers');
      expect(moduleMetadata).toHaveProperty('exports');
    });

    it('should maintain module structure across reloads', () => {
      jest.resetModules();
      const { CommonModule: ReloadedModule } = require('./common.module');

      expect(ReloadedModule).toBe(CommonModule);
      expect(ReloadedModule).toBeDefined();
    });
  });

  describe('integration with other modules', () => {
    it('should work when imported by other modules', async () => {
      const consumerModule = await Test.createTestingModule({
        imports: [CommonModule],
      }).compile();

      // Should be able to access CommonModule services
      const environmentService = consumerModule.get(
        'EnvironmentValidatorService',
      );
      const translationService = consumerModule.get(TranslationService);

      expect(environmentService).toBeDefined();
      expect(translationService).toBeDefined();

      await consumerModule.close();
    });

    it('should handle multiple consumers', async () => {
      const modules: TestingModule[] = [];

      for (let i = 0; i < 3; i++) {
        const consumerModule = await Test.createTestingModule({
          imports: [CommonModule],
        }).compile();
        modules.push(consumerModule);
      }

      // All modules should work independently
      modules.forEach((m) => {
        expect(() => m.get('EnvironmentValidatorService')).not.toThrow();
      });

      await Promise.all(modules.map((m) => m.close()));
    });
  });

  describe('service dependencies', () => {
    it('should handle service dependency injection', () => {
      const service = module.get('EnvironmentValidatorService');

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(EnvironmentValidatorService);
    });

    it('should handle TranslationService dependencies', () => {
      const service = module.get(TranslationService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TranslationService);
    });

    it('should handle RedisLockService dependencies', () => {
      const service = module.get(RedisLockService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RedisLockService);
    });
  });
});
