/* تنقية بيانات PII قبل الإرسال إلى Sentry */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// رقم دولي تقريبي (+) ومسافات/رموز شائعة، 9-20 خانة
export const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

function redactValue(v: unknown): unknown {
  if (typeof v === 'string') {
    return v
      .replace(EMAIL_RE, '[REDACTED:EMAIL]')
      .replace(PHONE_RE, '[REDACTED:PHONE]');
  }
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      // احذف الحقول الحساسة الشائعة
      if (
        [
          'password',
          'authorization',
          'cookie',
          'set-cookie',
          'token',
          'apikey',
          'api_key',
          'secret',
        ].includes(k.toLowerCase())
      ) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(val);
      }
    }
    return out;
  }
  return v;
}

export function redactEvent(event: any) {
  // رؤوس الطلب
  if (event?.request?.headers) {
    event.request.headers = redactValue(event.request.headers);
  }
  // الاستعلام/النص
  if (event?.request?.query_string) {
    event.request.query_string = String(event.request.query_string)
      .replace(EMAIL_RE, '[REDACTED:EMAIL]')
      .replace(PHONE_RE, '[REDACTED:PHONE]');
  }
  if (event?.request?.data) {
    event.request.data = redactValue(event.request.data);
  }
  // المستخدم/السياقات/الإضافات
  if (event?.user) event.user = redactValue(event.user);
  if (event?.contexts) event.contexts = redactValue(event.contexts);
  if (event?.extra) event.extra = redactValue(event.extra);
  if (event?.tags) event.tags = redactValue(event.tags);
  // البصمات/الفتات (breadcrumbs)
  if (Array.isArray(event?.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => redactValue(b));
  }
  return event;
}
