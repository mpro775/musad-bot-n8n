// src/main.ts
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });

  if (typeof globalThis.crypto === 'undefined') {
    (globalThis as any).crypto = { randomUUID };
  }

  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(helmet());
  // app.enableCors({
  //   origin: '*',
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true,
  // });
  app.enableCors({
    origin: (origin, cb) => {
      const allowList = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim());
      if (!origin) return cb(null, true); // أدوات/بوتات بلا Origin
      const ok = allowList.some(allowed => {
        // دعم wildcards بسيطة *.kaleem-ai.com
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return origin.endsWith('.' + domain);
        }
        return origin === allowed;
      });
      cb(null, ok);
    },
    credentials: true,
  });
  
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    app.get(HttpMetricsInterceptor),
  );

  // ⚠️ Raw body لمكالمات WhatsApp Cloud API فقط
  app.use('/api/webhooks/incoming', (req: any, res, next) => {
    const hasMetaSig = req.headers['x-hub-signature-256'];
    const isMetaVerify = !!req.query?.['hub.mode']; // GET verify
    if (hasMetaSig || isMetaVerify) {
      return bodyParser.raw({ type: '*/*' })(req, res, next);
    }
    return bodyParser.json()(req, res, next);
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Kaleem API')
    .setDescription('API documentation for Kaleem')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .setContact('Kaleem Team', 'https://kaleem-ai.com', 'support@kaleem-ai.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Local environment')
    .addServer('https://api.kaleem-ai.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      displayRequestDuration: true,
    },
    customSiteTitle: 'Kaleem API Docs',
    customfavIcon: 'https://kaleem-ai.com/favicon.ico',
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
  });

  app.set('trust proxy', 1);

  // حد تردد خاص بمسار الردود (احتراز ضد اللفات)
  app.use('/api/whatsapp/reply', rateLimit({ windowMs: 1000, max: 20 }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}

void bootstrap();
