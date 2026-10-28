import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
  /** طول النافذة الزمنية بالمللي ثانية. */
  windowMs: number;
  /** أقصى عدد محاولات مسموح بيها لكل مفتاح جوه النافذة. */
  max: number;
  /** حد أقصى للمفاتيح المتعقبة لحماية الذاكرة من مفاتيح عشوائية كثيرة. */
  maxTrackedKeys?: number;
  /** بيبني المفتاح اللي بيتحدد بيه كل طرف على حدة (IP، رقم هاتف، userId...). */
  keyFn: (req: Request) => string;
  /** رسالة عربية عامة ترجع في جسم رد الـ 429. */
  message: string;
}

/**
 * Rate limiter بسيط في الذاكرة (Fixed window) — بدون Redis/DB خارجي، بنفس
 * قاعدة "Free-tier/Local-only" اللي بُني عليها باقي قرارات الأمان في
 * المشروع (زي اختيار scrypt المدمج بدل bcrypt في security/password.ts).
 *
 * الحالة (attempts Map) بتتبنى مرة واحدة جوه كل استدعاء لـ createRateLimiter،
 * يعني كل Router factory (createAuthRouter مثلاً) بيعمل نسخة مستقلة بتتصفّر
 * تلقائيًا مع كل createApp(db) جديد — بالظبط زي freshMigratedDb() في
 * الاختبارات، فمفيش تسريب حالة بين الاختبارات المختلفة.
 *
 * القيد المعروف: الحالة محلية للـ Process نفسه — لو المشروع اتشغّل على أكتر
 * من Instance (Horizontal scaling) هيبقى العداد منفصل لكل Instance، مش
 * مشترك. مقبول للمرحلة الحالية (Local/Single-instance)، ومُوثّق هنا صراحة
 * عشان أي مرحلة مستقبلية تاخده في الاعتبار.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const maxTrackedKeys = options.maxTrackedKeys ?? 10_000;

  // تنضيف انتهازي (Opportunistic) للمفاتيح المنتهية — بيتشغّل كل 500 طلب
  // بدل كل طلب، عشان مايبقاش فيه تكلفة إضافية محسوسة على كل Request. بيمنع
  // تراكم غير محدود للمفاتيح (أرقام هاتف/IPs) اللي اتجرّبت مرة واحدة بس.
  let requestsSinceSweep = 0;
  const SWEEP_EVERY = 500;

  function sweep(now: number) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key);
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    requestsSinceSweep += 1;
    if (requestsSinceSweep >= SWEEP_EVERY) {
      requestsSinceSweep = 0;
      sweep(now);
    }

    const key = options.keyFn(req);
    const entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      if (attempts.size >= maxTrackedKeys) {
        sweep(now);
        if (attempts.size >= maxTrackedKeys) {
          const oldestKey = attempts.keys().next().value;
          if (oldestKey !== undefined) attempts.delete(oldestKey);
        }
      }
      attempts.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res
        .status(429)
        .set("Retry-After", String(retryAfterSeconds))
        .json({ error: options.message });
      return;
    }

    entry.count += 1;
    next();
  };
}
