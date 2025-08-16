import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/config/swagger.config';

async function generateSwagger() {
  // Provide default environment variables to satisfy module initialization
  process.env.MONGODB_URI ||= 'mongodb://localhost:27017/test';
  process.env.REDIS_URL ||= 'redis://localhost:6379';
  process.env.MINIO_ENDPOINT ||= 'localhost';
  process.env.MINIO_PORT ||= '9000';
  process.env.MINIO_USE_SSL ||= 'false';
  process.env.MINIO_ACCESS_KEY ||= 'dummy';
  process.env.MINIO_SECRET_KEY ||= 'dummy';
  process.env.JWT_SECRET ||= 'secret';
  process.env.MAIL_HOST ||= 'localhost';
  process.env.MAIL_PORT ||= '1025';
  process.env.MAIL_USER ||= 'user';
  process.env.MAIL_PASS ||= 'pass';
  process.env.MAIL_FROM ||= 'test@example.com';

  const app = await NestFactory.create(AppModule);
  const config = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  const outputPath = join(process.cwd(), 'docs');
  mkdirSync(outputPath, { recursive: true });
  writeFileSync(join(outputPath, 'swagger.json'), JSON.stringify(document, null, 2));

  await app.close();
}

void generateSwagger();
