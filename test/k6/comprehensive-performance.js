import { sleep, check, group } from 'k6';
import http from 'k6/http';

// k6 global - safe access pattern for environments without __ENV
const env = (globalThis && globalThis.__ENV) || {};

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users over 30 seconds
    { duration: '60s', target: 100 }, // Ramp up to 100 users over 60 seconds
    { duration: '120s', target: 150 }, // Ramp up to 150 users over 2 minutes
    { duration: '60s', target: 50 }, // Ramp down to 50 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Performance thresholds based on coding guidelines
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate should be below 10%
    http_reqs: ['count>1000'], // Should handle at least 1000 requests
    http_req_duration: ['p(99)<1000'], // 99% of requests should be below 1000ms
  },
};

const API_BASE = env.API_BASE || 'http://localhost:3000';

// Test scenarios based on coding guidelines requirements
export default function () {
  const merchantId = `merchant_${Math.floor(Math.random() * 1000)}`;

  group('Authentication & Authorization', function () {
    // Test login endpoint (should use proper error codes)
    const loginResponse = http.post(`${API_BASE}/auth/login`, {
      email: 'test@example.com',
      password: 'password123',
    });

    check(loginResponse, {
      'login status is 401 (invalid credentials)': (r) => r.status === 401,
      'login response time < 500ms': (r) => r.json().responseTime < 500,
      'login uses proper error code': (r) =>
        r.json().code === 'INVALID_CREDENTIALS',
    });

    sleep(1);
  });

  group('Product Management (following CQRS pattern)', function () {
    // Test products list (should use caching)
    const productsListResponse = http.get(
      `${API_BASE}/products?merchantId=${merchantId}&limit=20`,
    );

    check(productsListResponse, {
      'products list status 200': (r) => r.status === 200,
      'products list response time < 300ms': (r) => r.json().responseTime < 300,
      'products list uses pagination': (r) =>
        r.json().meta && r.json().meta.hasMore !== undefined,
      'products list follows DTO validation': (r) =>
        Array.isArray(r.json().items),
    });

    sleep(0.5);

    // Test product search (should use vector search optimization)
    const searchResponse = http.get(
      `${API_BASE}/products/search?q=laptop&merchantId=${merchantId}`,
    );

    check(searchResponse, {
      'search status 200': (r) => r.status === 200,
      'search response time < 800ms': (r) => r.json().responseTime < 800,
      'search uses proper pagination': (r) =>
        r.json().meta && r.json().meta.count !== undefined,
    });

    sleep(0.8);

    // Test product creation (should follow business error codes)
    const createProductResponse = http.post(`${API_BASE}/products`, {
      name: 'Test Product',
      price: 100,
      category: 'Electronics',
      merchantId: merchantId,
    });

    check(createProductResponse, {
      'create product status 401 (unauthorized)': (r) => r.status === 401,
      'create product uses proper error code': (r) =>
        r.json().code === 'UNAUTHORIZED',
    });

    sleep(1);
  });

  group('Cache Performance', function () {
    // Test cache effectiveness - first request should be slower than subsequent ones
    const startTime = new Date().getTime();

    const firstRequest = http.get(
      `${API_BASE}/products/public/test-store?limit=10`,
    );
    const firstResponseTime = new Date().getTime() - startTime;

    check(firstRequest, {
      'first request status 200': (r) => r.status === 200,
      'first request response time acceptable': (r) =>
        r.json().responseTime < 1000,
    });

    sleep(0.2);

    // Second request to same endpoint (should be cached)
    const secondStartTime = new Date().getTime();
    const secondRequest = http.get(
      `${API_BASE}/products/public/test-store?limit=10`,
    );
    const secondResponseTime = new Date().getTime() - secondStartTime;

    check(secondRequest, {
      'second request status 200': (r) => r.status === 200,
      'second request faster than first': () =>
        secondResponseTime < firstResponseTime,
    });

    sleep(0.5);
  });

  group('Error Handling & I18n', function () {
    // Test error handling with proper business error codes
    const invalidProductResponse = http.get(`${API_BASE}/products/invalid-id`);

    check(invalidProductResponse, {
      'invalid product returns 404': (r) => r.status === 404,
      'error response has proper code': (r) =>
        r.json().code === 'PRODUCT_NOT_FOUND',
      'error response includes requestId': (r) =>
        r.json().requestId !== undefined,
    });

    sleep(0.3);

    // Test validation errors (should use I18nMessage)
    const invalidDataResponse = http.post(`${API_BASE}/products`, {
      // Missing required fields
    });

    check(invalidDataResponse, {
      'validation error status 400': (r) => r.status === 400,
      'validation error uses proper codes': (r) =>
        r.json().code === 'VALIDATION_ERROR',
    });

    sleep(0.5);
  });

  group('Security & Guards', function () {
    // Test rate limiting (should be implemented per tenant)
    for (let i = 0; i < 5; i++) {
      const rateLimitResponse = http.get(
        `${API_BASE}/products/search?q=test&merchantId=${merchantId}`,
      );
      check(rateLimitResponse, {
        'rate limit test request': (r) => r.status >= 200 && r.status < 500,
      });
      sleep(0.1);
    }

    sleep(1);
  });
}
