import { createHash, randomInt } from "node:crypto";

// ============================================================================
// OTP / Phone verification — Dev-only fallback.
//
// قرار Phase 2 (موثّق بالتفصيل في HANDOFF.md بند "قرارات اتخذت"): الـ PRD
// (§16) بيطلب Phone verification لكن مش واضح إنها جزء من Auth الأساسي
// (register/login) ولا بس من Captain Onboarding المتقدم. بما إن
// users.verified_at بيفضل NULL دايمًا في هذه المرحلة، ومفيش Endpoint اتطلب
// صراحة لـ OTP في نطاق Phase 2 — الأداة دي جاهزة (مبنية ومُختبَرة القدرة
// عليها لاحقًا) لكن **مش متوصّلة بأي Route فعليًا في هذه المرحلة**. التوصيل
// الفعلي (توليد OTP عند التسجيل، Endpoint للتحقق، تحديث verified_at) قرار
// لمرحلة Captain Onboarding (Phase 3) لما الحاجة الفعلية للـ verification
// تبقى موجودة في الـ Flow.
//
// لو اتفعّلت لاحقًا: لازم توضيح صريح في أي UI/Response إن الإرسال بيبقى في
// الـ Server console/log بس (Dev-only)، عشان محدش يفتكرها SMS Gateway حقيقي
// إنتاجي — مفيش خدمة مدفوعة متاحة في هذه البيئة (قاعدة 2 العامة).
// ============================================================================

const OTP_DIGITS = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 دقائق.

export function generateOtp(): string {
  return randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, "0");
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function otpExpiryFromNow(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

/**
 * Dev-only fallback: بيطبع الـ OTP في الـ Server console بدل ما يبعته SMS
 * حقيقي (مفيش SMS Gateway مدفوع متاح). غير مستخدمة في أي Route في هذه
 * المرحلة — موجودة كأداة جاهزة لمرحلة Captain Onboarding.
 */
export function logOtpDevOnly(phoneNumber: string, otp: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[sekka-server][DEV-ONLY، مش SMS حقيقي] OTP لـ ${phoneNumber}: ${otp} (صالح 5 دقائق)`,
  );
}
