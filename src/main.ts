import './tracing';
import './polyfills';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import rateLimit from 'express-rate-limit';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ErrorLoggingInterceptor } from './common/interceptors/error-logging.interceptor';
import { PerformanceTrackingInterceptor } from './common/interceptors/performance-tracking.interceptor';
import * as bodyParser from 'body-parser';
import { ServerOptions } from 'socket.io';
import { corsOptions } from './common/config/cors.config';
import { setupApp } from './common/config/app.config';
import { I18nService } from 'nestjs-i18n';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { ConfigService } from '@nestjs/config';

function i18nizeSwagger(
  doc: OpenAPIObject,
  i18n: I18nService,
  lang = 'ar',
): OpenAPIObject {
  const translate = (val: any) => {
    if (typeof val === 'string' && val.startsWith('i18n:')) {
      const key = val.slice(5);
      try {
        return i18n.translate(key, { lang });
      } catch {
        return key;
      }
    }
    return val;
  };

  // paths
  const paths = (doc.paths ?? {}) as Record<string, any>;
  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // احصر العمليات في مفاتيح HTTP القياسية لتفادي قيم أخرى داخل PathItem
    const operations = [
      'get',
      'put',
      'post',
      'delete',
      'options',
      'head',
      'patch',
      'trace',
    ]
      .map((m) => (pathItem as any)[m])
      .filter(Boolean) as any[];

    for (const op of operations) {
      (op as any).summary = translate((op as any).summary);
      (op as any).description = translate((op as any).description);

      if (Array.isArray((op as any).parameters)) {
        for (const p of (op as any).parameters as any[]) {
          if (p && typeof p === 'object') {
            (p as any).description = translate((p as any).description);
          }
        }
      }

      const responses = (op as any).responses as
        | Record<string, any>
        | undefined;
      if (responses && typeof responses === 'object') {
        for (const r of Object.values(responses)) {
          if (r && typeof (r as any).description === 'string') {
            (r as any).description = translate((r as any).description);
          }
        }
      }
    }
  }

  // tags (إن وجدت)
  const tags = (doc.tags as any[]) || [];
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t === 'object') {
        (t as any).description = translate((t as any).description);
      }
    }
  }

  return doc;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser(process.env.COOKIE_SECRET)); // أضف COOKIE_SECRET
  const csrfMw = csurf({
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });

  app.use('/api', (req, res, next) => {
    const path = req.path || '';
    // استثناءات آمنة: webhooks, docs, health, metrics
    if (
      path.startsWith('/webhooks') ||
      path.startsWith('/docs') ||
      path.startsWith('/docs-json') ||
      path === '/health' ||
      path === '/metrics'
    ) {
      return next();
    }
    return csrfMw(req, res, next);
  });
  app.use((req: any, res, next) => {
    if (typeof req.csrfToken === 'function') {
      res.setHeader('X-CSRF-Token', req.csrfToken());
    }
    next();
  });
  // ✅ F1: التحقق من متغيرات البيئة الحرجة قبل البدء
  const envValidator = app.get('EnvironmentValidatorService');
  envValidator.validateOrExit();
  envValidator.logEnvironmentSummary();

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });

  if (typeof globalThis.crypto === 'undefined') {
    (globalThis as any).crypto = { randomUUID };
  }

  // ✅ D1: WsAdapter موحّد مع إعدادات محسّنة
  class WsAdapter extends IoAdapter {
    override createIOServer(port: number, options?: ServerOptions) {
      const ioCors = {
        origin: corsOptions.origin as any,
        methods: corsOptions.methods || ['GET', 'POST'],
        allowedHeaders: corsOptions.allowedHeaders,
        credentials: corsOptions.credentials || true,
        maxAge: corsOptions.maxAge,
      };

      const baseOptions = {
        path: '/api/chat',
        serveClient: false,
        cors: ioCors,
        allowEIO3: false,
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6,
        allowRequest: async (req: any, callback: any) => {
          const ok =
            typeof corsOptions.origin === 'function'
              ? await this.isOriginFnAllowed(
                  req.headers.origin,
                  corsOptions.origin,
                )
              : true;
          callback(null, ok);
        },
      };

      const wsOptions = options ? { ...baseOptions, ...options } : baseOptions;
      return super.createIOServer(port, wsOptions);
    }

    private isOriginFnAllowed(
      origin: string | undefined,
      originFn: any,
    ): Promise<boolean> {
      return new Promise((resolve) => {
        if (!origin) return resolve(false);
        try {
          originFn(origin, (err: any, allowed: boolean) =>
            resolve(!err && !!allowed),
          );
        } catch {
          resolve(false);
        }
      });
    }
  }

  app.useWebSocketAdapter(new WsAdapter(app));

  const config = app.get(ConfigService);
  setupApp(app, config);

  // إضافة فلتر الأخطاء المحسن
  const allExceptionsFilter = app.get(AllExceptionsFilter);
  app.useGlobalFilters(allExceptionsFilter);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  // إضافة الإنترسبتورات
  app.useGlobalInterceptors(
    app.get(HttpMetricsInterceptor),
    app.get(ErrorLoggingInterceptor),
    app.get(PerformanceTrackingInterceptor),
  );

  // تحضير دالة حفظ Raw Body للويبهوكس
  const captureRawBody = (req: any, _res: any, buf: Buffer) => {
    if (buf?.length) req.rawBody = Buffer.from(buf);
  };

  // ✅ مسارات الويبهوكس أولاً - مع Raw Body وحد 2MB
  app.use(
    '/api/webhooks',
    bodyParser.json({
      limit: '2mb',
      verify: captureRawBody,
      type: 'application/json',
    }),
  );
  app.use(
    '/api/webhooks',
    bodyParser.urlencoded({
      extended: true,
      limit: '2mb',
      verify: captureRawBody,
    }),
  );

  // ✅ باقي المسارات - حد 5MB للمسارات العامة
  app.use(bodyParser.json({ limit: '5mb', type: 'application/json' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
  app.use(bodyParser.raw({ limit: '1mb', type: 'application/octet-stream' }));
  app.use(bodyParser.text({ limit: '1mb', type: 'text/plain' }));

  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/merchants/:id/prompt/preview', (req, _res, next) => {
      console.log(
        '🔎 PREVIEW PARSED BODY:',
        req.headers['content-type'],
        req.body,
      );
      next();
    });
  }

  // Swagger
  const i18n = app.get(I18nService);
  const buildSwagger = (isProd: boolean) => {
    const config = new DocumentBuilder()
      .setTitle('Kaleem API')
      .setDescription(
        isProd
          ? 'API documentation for Kaleem - Production Environment'
          : 'API documentation for Kaleem',
      )
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
      .setContact(
        'Kaleem Team',
        'https://kaleem-ai.com',
        'support@kaleem-ai.com',
      )
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer('http://localhost:3000', 'Local environment')
      .addServer('https://api.kaleem-ai.com', 'Production')
      .build();

    const rawDoc = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    });
    const lang = process.env.SWAGGER_LANG || 'ar';
    const localized = i18nizeSwagger(
      rawDoc,
      i18n as I18nService<Record<string, unknown>>,
      lang,
    );
    return localized;
  };

  if (process.env.NODE_ENV !== 'production') {
    const document = buildSwagger(false);
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
  } else {
    const document = buildSwagger(true);

    // حماية مسار Swagger بـ JWT
    app.use('/api/docs*', (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'غير مصرح - يتطلب رمز JWT صالح للوصول للوثائق',
          code: 'UNAUTHORIZED_DOCS_ACCESS',
        });
        return;
      }

      const token = authHeader.split(' ')[1];
      try {
        const jwtService = app.get(JwtService);
        jwtService.verify(token, { secret: process.env.JWT_SECRET });
        next();
      } catch {
        res.status(403).json({
          success: false,
          message: 'رمز JWT غير صالح للوصول للوثائق',
          code: 'INVALID_JWT_DOCS_ACCESS',
        });
      }
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        displayRequestDuration: true,
      },
      customSiteTitle: 'Kaleem API Docs - Production',
    });
  }

  app.set('trust proxy', 1);

  // ✅ Rate Limits خاصة
  app.use(
    '/api/webhooks',
    rateLimit({
      windowMs: 60 * 1000,
      max: 180,
      message: {
        status: 429,
        code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
        message: 'تم تجاوز حد الطلبات للويبهوكس، الرجاء المحاولة لاحقاً',
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: {
        status: 429,
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'تم تجاوز حد طلبات المصادقة، الرجاء المحاولة لاحقاً',
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api/whatsapp/reply',
    rateLimit({
      windowMs: 1000,
      max: 20,
      message: {
        status: 429,
        code: 'WHATSAPP_REPLY_RATE_LIMIT_EXCEEDED',
        message: 'تم تجاوز حد ردود WhatsApp، الرجاء المحاولة لاحقاً',
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const port = process.env.PORT || 3000;
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}

void bootstrap();
