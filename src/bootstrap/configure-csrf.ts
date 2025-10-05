import csurf, { type CsrfOptions } from '@dr.pogodin/csurf';
import cookieParser from 'cookie-parser';

import type { INestApplication } from '@nestjs/common';
import type {
  Request as CoreRequest,
  Response as CoreResponse,
  NextFunction as CoreNext,
  RequestHandler as CoreHandler,
  ParamsDictionary,
} from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

type RequestHandler = CoreHandler<
  ParamsDictionary,
  unknown, // ResBody
  unknown, // ReqBody
  ParsedQs, // ReqQuery
  Record<string, unknown> // Locals
>;

type Request = CoreRequest<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  Record<string, unknown>
>;
type Response = CoreResponse<unknown, Record<string, unknown>>;
type NextFunction = CoreNext;

const CSRF_BYPASS_PREFIXES = ['/webhooks', '/docs', '/integrations/n8n'];
const CSRF_BYPASS_EXACT = ['/docs-json', '/health', '/metrics'];

interface CsrfRequest extends Request {
  csrfToken(): string;
  // ملاحظة: cookie-parser يضيف secret?: string — لا نجعلها مطلوبة
  secret?: string;
}

function hasCsrfToken(req: Request): req is CsrfRequest {
  return typeof (req as Partial<CsrfRequest>).csrfToken === 'function';
}

function isCsrfBypassPath(pathname: string): boolean {
  return (
    CSRF_BYPASS_EXACT.includes(pathname) ||
    CSRF_BYPASS_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export function configureCsrf(app: INestApplication): void {
  const cookieSecret = process.env.COOKIE_SECRET; // string | undefined

  // ✅ cookieParser يقبل secret اختياريًا
  app.use(cookieParser(cookieSecret));

  const csrfOptions: CsrfOptions = {
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  };

  // ✅ النوع مضبوط RequestHandler من نفس المصدر
  const csrfMw = csurf(csrfOptions) as unknown as RequestHandler;

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const pathname = req.path ?? '';
    if (isCsrfBypassPath(pathname)) return next();
    return csrfMw(req, res, next);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (hasCsrfToken(req)) {
      const r = req as CsrfRequest;
      res.setHeader('X-CSRF-Token', r.csrfToken());
    }
    next();
  });
}
