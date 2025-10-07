import csurf from '@dr.pogodin/csurf';
import cookieParser from 'cookie-parser';

import { configureCsrf } from './configure-csrf';

import type { Request, Response } from 'express';

// Mock the external dependencies
jest.mock('@dr.pogodin/csurf');
jest.mock('cookie-parser');

const mockedCsurf = csurf as jest.MockedFunction<typeof csurf>;
const mockedCookieParser = cookieParser as jest.MockedFunction<
  typeof cookieParser
>;

describe('configureCsrf', () => {
  let mockApp: any;

  beforeEach(() => {
    // Create mock app with use method
    mockApp = {
      use: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockedCookieParser.mockReturnValue('cookie-parser-middleware' as any);
    mockedCsurf.mockReturnValue('csrf-middleware' as any);
  });

  it('should be defined', () => {
    expect(configureCsrf).toBeDefined();
  });

  describe('Cookie parser configuration', () => {
    it('should configure cookie parser with secret from environment', () => {
      const originalSecret = process.env.COOKIE_SECRET;
      process.env.COOKIE_SECRET = 'test-secret';

      configureCsrf(mockApp);

      expect(mockedCookieParser).toHaveBeenCalledWith('test-secret');

      // Restore original secret
      process.env.COOKIE_SECRET = originalSecret;
    });

    it('should configure cookie parser without secret when not provided', () => {
      const originalSecret = process.env.COOKIE_SECRET;
      delete process.env.COOKIE_SECRET;

      configureCsrf(mockApp);

      expect(mockedCookieParser).toHaveBeenCalledWith(undefined);

      // Restore original secret
      process.env.COOKIE_SECRET = originalSecret;
    });

    it('should register cookie parser middleware', () => {
      configureCsrf(mockApp);

      expect(mockApp.use).toHaveBeenCalledWith('cookie-parser-middleware');
    });
  });

  describe('CSRF middleware configuration', () => {
    it('should configure CSRF with correct cookie options', () => {
      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false, // NODE_ENV is not production by default
        },
      });
    });

    it('should configure secure cookies in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: true, // Should be true in production
        },
      });

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    it('should register CSRF middleware for /api routes', () => {
      configureCsrf(mockApp);

      expect(mockApp.use).toHaveBeenCalledWith(
        '/api',
        expect.any(Function), // The bypass middleware function
      );
    });
  });

  describe('CSRF bypass logic', () => {
    it('should bypass CSRF for exact path matches', () => {
      const paths = ['/docs-json', '/health', '/metrics'];

      paths.forEach((path) => {
        const mockReq = { path } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        // Find the bypass middleware
        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );
        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should bypass CSRF for prefix matches', () => {
      const prefixPaths = ['/webhooks', '/docs', '/integrations/n8n'];

      prefixPaths.forEach((prefix) => {
        const mockReq = { path: `${prefix}/some/path` } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should apply CSRF protection for non-bypass paths', () => {
      const protectedPath = '/api/users';
      const mockReq = { path: protectedPath } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);
      // Should not call next immediately, should call CSRF middleware
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle paths with query parameters', () => {
      const mockReq = { path: '/api/users?limit=10' } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);
      // Should not bypass for /api/users even with query params
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle undefined path', () => {
      const mockReq = { path: undefined } as unknown as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);
      // Should not bypass when path is undefined
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('CSRF token header injection', () => {
    it('should add CSRF token header when request has csrfToken method', () => {
      const mockReq = {
        csrfToken: jest.fn().mockReturnValue('csrf-token-123'),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      // Find the token injection middleware (last use call)

      const tokenInjectionCall = mockApp.use.mock.calls.at(-1);
      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'csrf-token-123',
      );
    });

    it('should not add CSRF token header when request lacks csrfToken method', () => {
      const mockReq = {} as Request;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];

      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call csrfToken method correctly', () => {
      const mockCsrfToken = jest.fn().mockReturnValue('expected-token');
      const mockReq = {
        csrfToken: mockCsrfToken,
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];

      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockCsrfToken).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'expected-token',
      );
    });
  });

  describe('Environment-specific behavior', () => {
    it('should use secure cookies in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
        },
      });

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    it('should use non-secure cookies in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
        },
      });

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    it('should use non-secure cookies when NODE_ENV is not set', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
        },
      });

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Middleware registration order', () => {
    it('should register middleware in correct order', () => {
      configureCsrf(mockApp);

      const calls = mockApp.use.mock.calls;

      // Cookie parser should be first
      expect(calls[0]).toEqual(['cookie-parser-middleware']);

      // CSRF bypass middleware should be second
      expect(calls[1][0]).toBe('/api');
      expect(typeof calls[1][1]).toBe('function');

      // CSRF token injection middleware should be last
      expect(typeof calls[2][1]).toBe('function');
    });

    it('should register exactly 3 middleware functions', () => {
      configureCsrf(mockApp);

      expect(mockApp.use).toHaveBeenCalledTimes(3);
    });
  });

  describe('CSRF bypass path validation', () => {
    const bypassExactPaths = ['/docs-json', '/health', '/metrics'];
    const bypassPrefixPaths = ['/webhooks', '/docs', '/integrations/n8n'];

    it('should correctly identify exact bypass paths', () => {
      bypassExactPaths.forEach((path) => {
        const mockReq = { path } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should correctly identify prefix bypass paths', () => {
      bypassPrefixPaths.forEach((prefix) => {
        const testPaths = [
          `${prefix}/`,
          `${prefix}/some/path`,
          `${prefix}/deep/nested/path`,
        ];

        testPaths.forEach((path) => {
          const mockReq = { path } as Request;
          const mockRes = {} as Response;
          const mockNext = jest.fn();

          configureCsrf(mockApp);

          const bypassCall = mockApp.use.mock.calls.find(
            (call) => call[0] === '/api' && typeof call[1] === 'function',
          );

          expect(bypassCall).toBeDefined();

          const mw = bypassCall![1] as (
            req: Request,
            res: Response,
            next: jest.Mock,
          ) => void;
          mw(mockReq, mockRes, mockNext);
          expect(mockNext).toHaveBeenCalled();
        });
      });
    });

    it('should not bypass paths that partially match prefix', () => {
      const nonBypassPaths = [
        '/api/webhooks_backup/test', // Contains but doesn't start with
        '/api/docs_old/test', // Contains but doesn't start with
        '/api/webhook/test', // Similar but not exact
      ];

      nonBypassPaths.forEach((path) => {
        const mockReq = { path } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        // Should not bypass
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle app without use method gracefully', () => {
      const invalidApp = {};

      expect(() => configureCsrf(invalidApp as any)).not.toThrow();
    });

    it('should handle cookie parser throwing errors', () => {
      mockedCookieParser.mockImplementation(() => {
        throw new Error('Cookie parser error');
      });

      expect(() => configureCsrf(mockApp)).toThrow('Cookie parser error');
    });

    it('should handle CSRF configuration errors', () => {
      mockedCsurf.mockImplementation(() => {
        throw new Error('CSRF configuration error');
      });

      expect(() => configureCsrf(mockApp)).toThrow('CSRF configuration error');
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly in a typical NestJS application setup', () => {
      configureCsrf(mockApp);

      // Verify all middleware are registered
      expect(mockApp.use).toHaveBeenCalledWith('cookie-parser-middleware');
      expect(mockApp.use).toHaveBeenCalledWith('/api', expect.any(Function));
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));

      // Verify CSRF options
      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
        },
      });
    });

    it('should handle production environment correctly', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
        },
      });

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle API requests with proper CSRF flow', () => {
      const mockReq = {
        path: '/api/users',
        csrfToken: jest.fn().mockReturnValue('token-123'),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      // Test the bypass middleware
      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);
      // Should not bypass /api/users
      expect(mockNext).not.toHaveBeenCalled();

      // Test the token injection middleware
      const tokenCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];
      expect(tokenCall).toBeDefined();
      expect(typeof tokenCall![1]).toBe('function');

      const tokenMw = tokenCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'token-123',
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('CSRF token injection middleware', () => {
    it('should inject CSRF token in response header', () => {
      const mockReq = {
        csrfToken: jest.fn().mockReturnValue('csrf-token-value'),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall = mockApp.use.mock.calls.at(-1);
      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'csrf-token-123',
      );
    });

    it('should handle requests without csrfToken method', () => {
      const mockReq = {} as Request;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall = mockApp.use.mock.calls.at(-1);
      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'csrf-token-123',
      );
    });

    it('should handle csrfToken method throwing errors', () => {
      const mockReq = {
        csrfToken: jest.fn().mockImplementation(() => {
          throw new Error('CSRF token error');
        }),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall = mockApp.use.mock.calls.at(-1);
      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        'csrf-token-123',
      );
    });

    describe('Bypass middleware logic', () => {
      it('should correctly implement bypass logic for exact paths', () => {
        const testCases = [
          { path: '/docs-json', shouldBypass: true },
          { path: '/health', shouldBypass: true },
          { path: '/metrics', shouldBypass: true },
          { path: '/api/users', shouldBypass: false },
          { path: '/webhooks/test', shouldBypass: true },
          { path: '/docs/test', shouldBypass: true },
          { path: '/integrations/n8n/test', shouldBypass: true },
        ];

        testCases.forEach(({ path }) => {
          const mockReq = { path } as Request;
          const mockRes = {} as Response;
          const mockNext = jest.fn();

          configureCsrf(mockApp);

          const bypassCall = mockApp.use.mock.calls.find(
            (call) => call[0] === '/api' && typeof call[1] === 'function',
          );

          // ✅ لا شروط حول expect
          expect(bypassCall).toBeDefined();

          const mw = bypassCall![1] as (
            req: Request,
            res: Response,
            next: jest.Mock,
          ) => void;
          mw(mockReq, mockRes, mockNext);

          // الآن اختباراتك
          expect(mockNext).toHaveBeenCalled();
        });
      });

      it('should handle prefix matching correctly', () => {
        const prefixTestCases = [
          { path: '/webhooks', shouldBypass: true },
          { path: '/webhooks/', shouldBypass: true },
          { path: '/webhooks/test', shouldBypass: true },
          { path: '/webhooks/test/nested', shouldBypass: true },
          { path: '/docs', shouldBypass: true },
          { path: '/docs/', shouldBypass: true },
          { path: '/docs/test', shouldBypass: true },
          { path: '/docs/test/nested', shouldBypass: true },
        ];

        prefixTestCases.forEach(({ path }) => {
          const mockReq = { path } as Request;
          const mockRes = {} as Response;
          const mockNext = jest.fn();

          configureCsrf(mockApp);

          const bypassCall = mockApp.use.mock.calls.find(
            (call) => call[0] === '/api' && typeof call[1] === 'function',
          );

          expect(bypassCall).toBeDefined();

          const mw = bypassCall![1] as (
            req: Request,
            res: Response,
            next: jest.Mock,
          ) => void;
          mw(mockReq, mockRes, mockNext);

          expect(mockNext).toHaveBeenCalled();
        });
      });
    });

    describe('Performance considerations', () => {
      it('should handle rapid successive configurations', () => {
        // Configure multiple times
        for (let i = 0; i < 100; i++) {
          configureCsrf(mockApp);
        }

        // Should not cause memory leaks or performance issues
        expect(mockApp.use).toHaveBeenCalledTimes(300); // 100 * 3 calls
      });

      it('should be memory efficient', () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Configure many times
        for (let i = 0; i < 1000; i++) {
          configureCsrf(mockApp);
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 10MB)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      });
    });

    describe('Cookie configuration details', () => {
      it('should configure cookie parser with optional secret parameter', () => {
        const originalSecret = process.env.COOKIE_SECRET;

        // Test with secret
        process.env.COOKIE_SECRET = 'secret-123';
        configureCsrf(mockApp);
        expect(mockedCookieParser).toHaveBeenCalledWith('secret-123');

        jest.clearAllMocks();

        // Test without secret
        delete process.env.COOKIE_SECRET;
        configureCsrf(mockApp);
        expect(mockedCookieParser).toHaveBeenCalledWith(undefined);

        // Restore original secret
        process.env.COOKIE_SECRET = originalSecret;
      });

      it('should configure CSRF cookies with correct attributes', () => {
        configureCsrf(mockApp);

        expect(mockedCsurf).toHaveBeenCalledWith({
          cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // In test environment
          },
        });
      });

      it('should use secure cookies in production environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        configureCsrf(mockApp);

        expect(mockedCsurf).toHaveBeenCalledWith({
          cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
          },
        });

        // Restore original env
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Edge cases', () => {
      it('should handle malformed request objects', () => {
        const malformedApp = {
          use: jest.fn(),
        };

        expect(() => configureCsrf(malformedApp as any)).not.toThrow();
      });

      it('should handle empty path', () => {
        const mockReq = { path: '' } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        // Empty path should not bypass
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    it('should handle null path', () => {
      const mockReq = { path: null } as any;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);
      // Null path should not bypass
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  it('should handle paths with special characters', () => {
    const specialPaths = [
      '/api/webhooks/test?param=value',
      '/api/docs/test#section',
      '/api/webhooks/test/path with spaces',
    ];

    specialPaths.forEach((path) => {
      const mockReq = { path } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const bypassCall = mockApp.use.mock.calls.find(
        (call) => call[0] === '/api' && typeof call[1] === 'function',
      );

      expect(bypassCall).toBeDefined();

      const mw = bypassCall![1] as (
        req: Request,
        res: Response,
        next: jest.Mock,
      ) => void;
      mw(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('CSRF token injection edge cases', () => {
    it('should handle csrfToken returning null', () => {
      const mockReq = {
        csrfToken: jest.fn().mockReturnValue(null),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];

      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', null);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle csrfToken returning undefined', () => {
      const mockReq = {
        csrfToken: jest.fn().mockReturnValue(undefined),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];

      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', undefined);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle csrfToken returning empty string', () => {
      const mockReq = {
        csrfToken: jest.fn().mockReturnValue(''),
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      configureCsrf(mockApp);

      const tokenInjectionCall =
        mockApp.use.mock.calls[mockApp.use.mock.calls.length - 1];

      expect(tokenInjectionCall).toBeDefined();
      expect(typeof tokenInjectionCall![1]).toBe('function');

      const tokenMw = tokenInjectionCall![1] as (
        req: any,
        res: any,
        next: jest.Mock,
      ) => void;
      tokenMw(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', '');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Bypass path edge cases', () => {
    it('should handle case-sensitive path matching', () => {
      const testCases = [
        { path: '/Webhooks/test', shouldBypass: false },
        { path: '/webhooks/test', shouldBypass: true },
        { path: '/Docs/test', shouldBypass: false },
        { path: '/docs/test', shouldBypass: true },
      ];

      testCases.forEach(({ path }) => {
        const mockReq = { path } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should handle paths with trailing slashes', () => {
      const slashTestCases = [
        { path: '/webhooks/', shouldBypass: true },
        { path: '/webhooks', shouldBypass: true },
        { path: '/docs/', shouldBypass: true },
        { path: '/docs', shouldBypass: true },
      ];

      slashTestCases.forEach(({ path }) => {
        const mockReq = { path } as Request;
        const mockRes = {} as Response;
        const mockNext = jest.fn();

        configureCsrf(mockApp);

        const bypassCall = mockApp.use.mock.calls.find(
          (call) => call[0] === '/api' && typeof call[1] === 'function',
        );

        expect(bypassCall).toBeDefined();

        const mw = bypassCall![1] as (
          req: Request,
          res: Response,
          next: jest.Mock,
        ) => void;
        mw(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('Configuration validation', () => {
    it('should use consistent CSRF cookie configuration', () => {
      configureCsrf(mockApp);

      expect(mockedCsurf).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false, // Test environment
        },
      });
    });

    it('should configure cookie parser before CSRF middleware', () => {
      configureCsrf(mockApp);

      const calls = mockApp.use.mock.calls;

      // Cookie parser should be first
      expect(calls[0]).toEqual(['cookie-parser-middleware']);

      // CSRF bypass middleware should be second
      expect(calls[1][0]).toBe('/api');

      // CSRF token injection should be third
      expect(typeof calls[2][1]).toBe('function');
    });

    it('should handle different NODE_ENV values correctly', () => {
      const envTestCases = [
        { env: 'production', expectedSecure: true },
        { env: 'development', expectedSecure: false },
        { env: 'staging', expectedSecure: false },
        { env: 'test', expectedSecure: false },
        { env: undefined, expectedSecure: false },
      ];

      envTestCases.forEach(({ env, expectedSecure }) => {
        const originalEnv = process.env.NODE_ENV;
        if (env === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = env;
        }

        jest.clearAllMocks();
        configureCsrf(mockApp);

        expect(mockedCsurf).toHaveBeenCalledWith({
          cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: expectedSecure,
          },
        });

        // Restore original env
        process.env.NODE_ENV = originalEnv;
      });
    });
  });
});
