import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32; // 256-bit، طول كافي لـ Session token عشوائي.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم.

/** الـ Token الخام اللي بيتبعت للعميل مرة واحدة بس عند login — ميتسجّلش في الـ DB. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** الـ Hash بتاع الـ Token اللي فعليًا بيتخزن/بيتدوّر عليه في جدول sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
