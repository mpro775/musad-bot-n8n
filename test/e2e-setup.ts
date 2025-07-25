import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';

let mongod: MongoMemoryServer;
let app: INestApplication;

// Global E2E test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Start in-memory MongoDB
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  
  // Mock console methods
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  // Close app and database
  if (app) {
    await app.close();
  }
  
  if (mongod) {
    await mongod.stop();
  }
  
  // Restore console methods
  jest.restoreAllMocks();
});

// E2E test utilities
export const createE2ETestingModule = async (moduleClass: any, additionalImports: any[] = []) => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      MongooseModule.forRoot(process.env.MONGODB_URI),
      moduleClass,
      ...additionalImports,
    ],
  }).compile();

  app = moduleFixture.createNestApplication();
  
  // Apply global pipes, guards, interceptors here if needed
  // app.useGlobalPipes(new ValidationPipe());
  
  await app.init();
  return { app, moduleFixture };
};

export const getRequest = () => request(app.getHttpServer());

// Database utilities
export const clearDatabase = async () => {
  if (mongod) {
    const collections = await mongod.getDbInstance().collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
};

// Authentication utilities
export const createAuthenticatedRequest = async (userPayload = {}) => {
  const defaultUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    username: 'testuser',
    ...userPayload,
  };
  
  // Mock JWT token creation - adjust based on your auth implementation
  const token = 'mock-jwt-token';
  
  return {
    token,
    user: defaultUser,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// Response validation utilities
export const expectValidationError = (response: any, field?: string) => {
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('message');
  if (field) {
    expect(response.body.message).toContain(field);
  }
};

export const expectUnauthorized = (response: any) => {
  expect(response.status).toBe(401);
  expect(response.body).toHaveProperty('message');
};

export const expectForbidden = (response: any) => {
  expect(response.status).toBe(403);
  expect(response.body).toHaveProperty('message');
};

export const expectNotFound = (response: any) => {
  expect(response.status).toBe(404);
  expect(response.body).toHaveProperty('message');
};

export const expectSuccess = (response: any, expectedData?: any) => {
  expect(response.status).toBeLessThan(400);
  if (expectedData) {
    expect(response.body).toMatchObject(expectedData);
  }
};
