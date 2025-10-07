import { IoAdapter } from '@nestjs/platform-socket.io';

import { corsOptions } from '../common/config/cors.config';
import {
  PING_TIMEOUT,
  PING_INTERVAL,
  UPGRADE_TIMEOUT,
  MAX_HTTP_BUFFER_SIZE,
} from '../common/constants/common';

import { configureWebsocket } from './configure-websocket';

// Mock the external dependencies
jest.mock('@nestjs/platform-socket.io');
jest.mock('../common/config/cors.config');
jest.mock('../common/constants/common');

const mockedIoAdapter = IoAdapter as jest.MockedClass<typeof IoAdapter>;
const mockedCorsOptions = corsOptions as jest.Mocked<typeof corsOptions>;

describe('configureWebsocket', () => {
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      useWebSocketAdapter: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockedIoAdapter.mockImplementation(() => ({}) as IoAdapter);
  });

  it('should be defined', () => {
    expect(configureWebsocket).toBeDefined();
  });

  describe('WebSocket adapter configuration', () => {
    it('should create WsAdapter instance', () => {
      configureWebsocket(mockApp);

      expect(mockedIoAdapter).toHaveBeenCalledWith(mockApp);
    });

    it('should configure app to use WebSocket adapter', () => {
      const mockAdapter = {};
      mockedIoAdapter.mockReturnValue(mockAdapter as IoAdapter);

      configureWebsocket(mockApp);

      expect(mockApp.useWebSocketAdapter).toHaveBeenCalledWith(mockAdapter);
    });

    it('should handle adapter creation errors gracefully', () => {
      mockedIoAdapter.mockImplementation(() => {
        throw new Error('Adapter creation failed');
      });

      expect(() => configureWebsocket(mockApp)).toThrow(
        'Adapter creation failed',
      );
    });

    it('should handle null/undefined adapter', () => {
      mockedIoAdapter.mockReturnValue(null as any);

      expect(() => configureWebsocket(mockApp)).not.toThrow();

      expect(mockApp.useWebSocketAdapter).toHaveBeenCalledWith(null);
    });
  });

  describe('WsAdapter configuration', () => {
    let mockWsAdapter: any;

    beforeEach(() => {
      mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      };
      mockedIoAdapter.mockReturnValue(mockWsAdapter);
    });

    it('should configure WebSocket server with correct path', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          path: '/api/chat',
        }),
      );
    });

    it('should configure WebSocket server to not serve client', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          serveClient: false,
        }),
      );
    });

    it('should configure CORS options for WebSocket', () => {
      const mockCorsConfig = {
        origin: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['*'],
        credentials: true,
        maxAge: 3600,
      };

      mockedCorsOptions.origin = mockCorsConfig.origin;
      mockedCorsOptions.methods = mockCorsConfig.methods;
      mockedCorsOptions.allowedHeaders = mockCorsConfig.allowedHeaders;
      mockedCorsOptions.credentials = mockCorsConfig.credentials;
      mockedCorsOptions.maxAge = mockCorsConfig.maxAge;

      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          cors: {
            origin: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['*'],
            credentials: true,
            maxAge: 3600,
          },
        }),
      );
    });

    it('should configure ping timeout', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          pingTimeout: PING_TIMEOUT,
        }),
      );
    });

    it('should configure ping interval', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          pingInterval: PING_INTERVAL,
        }),
      );
    });

    it('should configure upgrade timeout', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          upgradeTimeout: UPGRADE_TIMEOUT,
        }),
      );
    });

    it('should configure max HTTP buffer size', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
        }),
      );
    });

    it('should disable EIO3 support', () => {
      configureWebsocket(mockApp);

      expect(mockWsAdapter.createIOServer).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          allowEIO3: false,
        }),
      );
    });

    it('should configure origin checking', () => {
      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowRequest).toBeDefined();
      expect(typeof options.allowRequest).toBe('function');
    });
  });

  describe('Origin validation', () => {
    let mockWsAdapter: any;

    beforeEach(() => {
      mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      };
      mockedIoAdapter.mockReturnValue(mockWsAdapter);
    });

    it('should use CORS origin function when configured', () => {
      const mockOriginFn = jest.fn();
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];
      const mockReq = {
        headers: { origin: 'https://example.com' },
      } as any;
      const mockCallback = jest.fn();

      expect(options.allowRequest).toBeDefined();

      options.allowRequest!(mockReq, mockCallback);

      expect(mockWsAdapter.isOriginFnAllowed).toHaveBeenCalledWith(
        'https://example.com',
        mockOriginFn,
      );
    });

    it('should allow request when origin function allows it', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        callback(undefined, true);
      });
      mockedCorsOptions.origin = mockOriginFn;
      mockWsAdapter.isOriginFnAllowed.mockResolvedValue(true);

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];
      const mockReq = {
        headers: { origin: 'https://example.com' },
      } as any;
      const mockCallback = jest.fn();

      expect(options.allowRequest).toBeDefined();

      await options.allowRequest!(mockReq, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(undefined, true);
    });

    it('should reject request when origin function rejects it', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        callback('Origin not allowed', false);
      });
      mockedCorsOptions.origin = mockOriginFn;
      mockWsAdapter.isOriginFnAllowed.mockResolvedValue(false);

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];
      const mockReq = {
        headers: { origin: 'https://malicious.com' },
      } as any;
      const mockCallback = jest.fn();

      expect(options.allowRequest).toBeDefined();

      await options.allowRequest!(mockReq, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith('Origin not allowed', false);
    });

    it('should allow request when no origin function is configured', () => {
      mockedCorsOptions.origin = true; // Not a function

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];
      const mockReq = {
        headers: { origin: 'https://example.com' },
      } as any;
      const mockCallback = jest.fn();

      expect(options.allowRequest).toBeDefined();

      options.allowRequest!(mockReq, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(undefined, true);
    });

    it('should handle requests without origin header', async () => {
      const mockOriginFn = jest.fn();
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];
      const mockReq = {
        headers: {},
      } as any;
      const mockCallback = jest.fn();

      expect(options.allowRequest).toBeDefined();

      await options.allowRequest!(mockReq, mockCallback);

      expect(mockWsAdapter.isOriginFnAllowed).toHaveBeenCalledWith(
        undefined,
        mockOriginFn,
      );
    });
  });

  describe('isOriginFnAllowed method', () => {
    let mockWsAdapter: any;

    beforeEach(() => {
      mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      };
      mockedIoAdapter.mockReturnValue(mockWsAdapter);
    });

    it('should resolve true for allowed origins', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        callback(undefined, true);
      });

      configureWebsocket(mockApp);

      const result = await mockWsAdapter.isOriginFnAllowed(
        'https://example.com',
        mockOriginFn,
      );

      expect(result).toBe(true);
    });

    it('should resolve false for rejected origins', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        callback('Not allowed', false);
      });

      configureWebsocket(mockApp);

      const result = await mockWsAdapter.isOriginFnAllowed(
        'https://malicious.com',
        mockOriginFn,
      );

      expect(result).toBe(false);
    });

    it('should resolve false when origin is undefined', async () => {
      const mockOriginFn = jest.fn();

      configureWebsocket(mockApp);

      const result = await mockWsAdapter.isOriginFnAllowed(
        undefined,
        mockOriginFn,
      );

      expect(result).toBe(false);
      expect(mockOriginFn).not.toHaveBeenCalled();
    });

    it('should resolve false when origin function throws error', async () => {
      const mockOriginFn = jest.fn(() => {
        throw new Error('Origin check failed');
      });

      configureWebsocket(mockApp);

      const result = await mockWsAdapter.isOriginFnAllowed(
        'https://example.com',
        mockOriginFn,
      );

      expect(result).toBe(false);
    });

    it('should handle origin function correctly', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        if (origin === 'https://allowed.com') {
          callback(undefined, true);
        } else {
          callback('Not allowed', false);
        }
      });

      configureWebsocket(mockApp);

      const result1 = await mockWsAdapter.isOriginFnAllowed(
        'https://allowed.com',
        mockOriginFn,
      );
      const result2 = await mockWsAdapter.isOriginFnAllowed(
        'https://blocked.com',
        mockOriginFn,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockOriginFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly in a typical NestJS application setup', () => {
      configureWebsocket(mockApp);

      expect(mockedIoAdapter).toHaveBeenCalledWith(mockApp);
      expect(mockApp.useWebSocketAdapter).toHaveBeenCalled();
    });

    it('should handle multiple WebSocket configurations', () => {
      // Configure multiple times
      configureWebsocket(mockApp);
      configureWebsocket(mockApp);

      expect(mockedIoAdapter).toHaveBeenCalledTimes(2);
      expect(mockApp.useWebSocketAdapter).toHaveBeenCalledTimes(2);
    });

    it('should configure complete WebSocket server setup', () => {
      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const port = createCall[0];
      const options = createCall[1];

      expect(typeof port).toBe('number');
      expect(options.path).toBe('/api/chat');
      expect(options.serveClient).toBe(false);
      expect(options.allowEIO3).toBe(false);
      expect(options.pingTimeout).toBe(PING_TIMEOUT);
      expect(options.pingInterval).toBe(PING_INTERVAL);
      expect(options.upgradeTimeout).toBe(UPGRADE_TIMEOUT);
      expect(options.maxHttpBufferSize).toBe(MAX_HTTP_BUFFER_SIZE);
      expect(options.allowRequest).toBeDefined();
      expect(options.cors).toBeDefined();
    });
  });

  describe('Performance considerations', () => {
    it('should handle rapid successive configurations', () => {
      // Configure multiple times
      for (let i = 0; i < 100; i++) {
        configureWebsocket(mockApp);
      }

      expect(mockedIoAdapter).toHaveBeenCalledTimes(100);
      expect(mockApp.useWebSocketAdapter).toHaveBeenCalledTimes(100);
    });

    it('should be memory efficient', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Configure many times
      for (let i = 0; i < 1000; i++) {
        configureWebsocket(mockApp);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error handling', () => {
    it('should handle app without required methods gracefully', () => {
      const invalidApp = {};

      expect(() => configureWebsocket(invalidApp as any)).not.toThrow();
    });

    it('should handle adapter creation errors', () => {
      mockedIoAdapter.mockImplementation(() => {
        throw new Error('Adapter creation failed');
      });

      expect(() => configureWebsocket(mockApp)).toThrow(
        'Adapter creation failed',
      );
    });

    it('should handle useWebSocketAdapter errors', () => {
      mockApp.useWebSocketAdapter.mockImplementation(() => {
        throw new Error('WebSocket adapter setup failed');
      });

      expect(() => configureWebsocket(mockApp)).toThrow(
        'WebSocket adapter setup failed',
      );
    });

    it('should handle server creation errors', () => {
      const mockWsAdapter = {
        createIOServer: jest.fn().mockImplementation(() => {
          throw new Error('Server creation failed');
        }),
      };
      mockedIoAdapter.mockReturnValue(mockWsAdapter as unknown as IoAdapter);

      expect(() => configureWebsocket(mockApp)).toThrow(
        'Server creation failed',
      );
    });

    it('should handle origin validation errors', async () => {
      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest
          .fn()
          .mockRejectedValue(new Error('Origin validation failed')),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const mockOriginFn = jest.fn();
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowRequest).toBeDefined();

      const mockReq = {
        headers: { origin: 'https://example.com' },
      } as any;
      const mockCallback = jest.fn();

      await expect(
        options.allowRequest!(mockReq, mockCallback),
      ).rejects.toThrow('Origin validation failed');
    });
  });

  describe('Configuration validation', () => {
    it('should always use correct WebSocket path', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.path).toBe('/api/chat');
    });

    it('should always disable client serving', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.serveClient).toBe(false);
    });

    it('should always disable EIO3 support', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowEIO3).toBe(false);
    });

    it('should always configure ping settings', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.pingTimeout).toBe(PING_TIMEOUT);
      expect(options.pingInterval).toBe(PING_INTERVAL);
    });

    it('should always configure timeout settings', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.upgradeTimeout).toBe(UPGRADE_TIMEOUT);
      expect(options.maxHttpBufferSize).toBe(MAX_HTTP_BUFFER_SIZE);
    });

    it('should always configure origin checking', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowRequest).toBeDefined();
      expect(typeof options.allowRequest).toBe('function');
    });

    it('should always configure CORS settings', () => {
      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors).toBeDefined();
      expect(options.cors.origin).toBe(true);
    });
  });

  describe('CORS configuration details', () => {
    it('should use CORS options from config', () => {
      const mockCorsConfig = {
        origin: true,
        methods: ['GET', 'POST', 'PUT'],
        allowedHeaders: ['authorization', 'content-type'],
        credentials: true,
        maxAge: 7200,
      };

      mockedCorsOptions.origin = mockCorsConfig.origin;
      mockedCorsOptions.methods = mockCorsConfig.methods;
      mockedCorsOptions.allowedHeaders = mockCorsConfig.allowedHeaders;
      mockedCorsOptions.credentials = mockCorsConfig.credentials;
      mockedCorsOptions.maxAge = mockCorsConfig.maxAge;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors.origin).toBe(true);
      expect(options.cors.methods).toEqual(['GET', 'POST', 'PUT']);
      expect(options.cors.allowedHeaders).toEqual([
        'authorization',
        'content-type',
      ]);
      expect(options.cors.credentials).toBe(true);
      expect(options.cors.maxAge).toBe(7200);
    });

    it('should handle missing CORS methods', () => {
      mockedCorsOptions.methods = undefined as any;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors.methods).toEqual(['GET', 'POST']);
    });

    it('should handle missing CORS credentials', () => {
      mockedCorsOptions.credentials = undefined as any;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors.credentials).toBe(true);
    });

    it('should handle missing CORS maxAge', () => {
      mockedCorsOptions.maxAge = undefined as any;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors.maxAge).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed app object', () => {
      const invalidApp = {};

      expect(() => configureWebsocket(invalidApp as any)).not.toThrow();
    });

    it('should handle CORS options being null', () => {
      mockedCorsOptions.origin = null as any;
      mockedCorsOptions.methods = null as any;
      mockedCorsOptions.allowedHeaders = null as any;
      mockedCorsOptions.credentials = null as any;
      mockedCorsOptions.maxAge = null as any;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.cors.origin).toBe(true); // Default fallback
      expect(options.cors.methods).toEqual(['GET', 'POST']); // Default fallback
      expect(options.cors.allowedHeaders).toBeDefined();
      expect(options.cors.credentials).toBe(true); // Default fallback
    });

    it('should handle server creation with custom options', () => {
      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      configureWebsocket(mockApp);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const port = createCall[0];
      const options = createCall[1];

      expect(typeof port).toBe('number');
      expect(options.pingTimeout).toBe(PING_TIMEOUT); // Should use default
      expect(options.maxHttpBufferSize).toBe(MAX_HTTP_BUFFER_SIZE); // Should use default
    });

    it('should handle missing constants', () => {
      // Mock missing constants
      const originalPingTimeout = PING_TIMEOUT;
      const originalPingInterval = PING_INTERVAL;
      const originalUpgradeTimeout = UPGRADE_TIMEOUT;
      const originalMaxBufferSize = MAX_HTTP_BUFFER_SIZE;

      // Temporarily set to undefined
      Object.defineProperty(
        require('../common/constants/common'),
        'PING_TIMEOUT',
        { value: undefined },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'PING_INTERVAL',
        { value: undefined },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'UPGRADE_TIMEOUT',
        { value: undefined },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'MAX_HTTP_BUFFER_SIZE',
        { value: undefined },
      );

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      // Should handle undefined constants gracefully
      expect(options.pingTimeout).toBeUndefined();
      expect(options.pingInterval).toBeUndefined();
      expect(options.upgradeTimeout).toBeUndefined();
      expect(options.maxHttpBufferSize).toBeUndefined();

      // Restore constants
      Object.defineProperty(
        require('../common/constants/common'),
        'PING_TIMEOUT',
        { value: originalPingTimeout },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'PING_INTERVAL',
        { value: originalPingInterval },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'UPGRADE_TIMEOUT',
        { value: originalUpgradeTimeout },
      );
      Object.defineProperty(
        require('../common/constants/common'),
        'MAX_HTTP_BUFFER_SIZE',
        { value: originalMaxBufferSize },
      );
    });

    it('should handle origin function throwing errors', async () => {
      const mockOriginFn = jest.fn(() => {
        throw new Error('Origin function error');
      });
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const result = await mockWsAdapter.isOriginFnAllowed(
        'https://example.com',
        mockOriginFn,
      );

      expect(result).toBe(false);
      expect(mockOriginFn).toHaveBeenCalled();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle production WebSocket configuration', () => {
      // Simulate production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      // Should be configured for production
      expect(options.path).toBe('/api/chat');
      expect(options.serveClient).toBe(false);
      expect(options.allowEIO3).toBe(false);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle development WebSocket configuration', () => {
      // Simulate development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      // Should be configured for development
      expect(options.path).toBe('/api/chat');
      expect(options.serveClient).toBe(false);
      expect(options.allowEIO3).toBe(false);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle WebSocket connection from allowed origin', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        if (origin === 'https://myapp.com') {
          callback(undefined, true);
        } else {
          callback('Origin not allowed', false);
        }
      });
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowRequest).toBeDefined();

      const mockReq = {
        headers: { origin: 'https://myapp.com' },
      } as any;
      const mockCallback = jest.fn();

      await options.allowRequest!(mockReq, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(undefined, true);
    });

    it('should reject WebSocket connection from blocked origin', async () => {
      const mockOriginFn = jest.fn((origin, callback) => {
        if (origin === 'https://myapp.com') {
          callback(undefined, true);
        } else {
          callback('Origin not allowed', false);
        }
      });
      mockedCorsOptions.origin = mockOriginFn;

      configureWebsocket(mockApp);

      const mockWsAdapter = {
        createIOServer: jest.fn(),
        isOriginFnAllowed: jest.fn(),
      } as any;
      mockedIoAdapter.mockReturnValue(mockWsAdapter);

      const createCall = mockWsAdapter.createIOServer.mock.calls[0];
      const options = createCall[1];

      expect(options.allowRequest).toBeDefined();

      const mockReq = {
        headers: { origin: 'https://malicious.com' },
      } as any;
      const mockCallback = jest.fn();

      await options.allowRequest!(mockReq, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith('Origin not allowed', false);
    });
  });
});
