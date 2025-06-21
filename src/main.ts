// src/main.ts

import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // نطبّق الــ global prefix "api" على كل المسارات ما عدا /api/metrics
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'api/metrics', method: RequestMethod.GET }],
  });
  if (typeof globalThis.crypto === 'undefined') {
    // نعرف كائن crypto عالمي يستخدم دالة randomUUID من Node
    (globalThis as any).crypto = { randomUUID };
  }

  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('MusaidBot API')
    .setDescription('API documentation for MusaidBot')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // مسار مخصص لتخفيف الضغط على WhatsApp
  app.use('/api/whatsapp/reply', rateLimit({ windowMs: 1000, max: 20 }));

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}

bootstrap();
