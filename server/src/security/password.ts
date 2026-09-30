import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt بدل bcrypt/argon2 عشان الاتنين محتاجين Native bindings خارجية —
// scrypt مدمج في node:crypto (قاعدة Free-tier/Local-only، قاعدة 2).
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * بيرجّع سلسلة واحدة "<salt_hex>:<derived_key_hex>" — الـ Salt متخزّن مع
 * الـ Hash في نفس العمود (مش عمودين منفصلين)، عشان أبسط في التخزين
 * والاسترجاع من غير الحاجة لعمود إضافي في الـ DB.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const expectedKey = Buffer.from(keyHex, "hex");
  const actualKey = scryptSync(password, salt, expectedKey.length);

  // timingSafeEqual بدل === عشان نتجنب Timing attack عند مقارنة الـ Hash.
  return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
}
