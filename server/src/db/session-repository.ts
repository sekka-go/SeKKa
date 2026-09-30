import type { DatabaseSync } from "node:sqlite";
import { SESSION_TTL_MS } from "../security/session-token.js";

export interface SessionRecord {
  id: number;
  user_id: number;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export function createSession(db: DatabaseSync, userId: number, tokenHash: string): SessionRecord {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const result = db
    .prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(userId, tokenHash, expiresAt);

  const row = db
    .prepare(
      "SELECT id, user_id, token_hash, created_at, expires_at, revoked_at FROM sessions WHERE id = ?",
    )
    .get(Number(result.lastInsertRowid)) as unknown as SessionRecord;
  return { ...row };
}

/** بترجع الجلسة بس لو موجودة، مش ملغاة (revoked_at IS NULL)، ولسه مانتهتش صلاحيتها. */
export function findActiveSessionByTokenHash(
  db: DatabaseSync,
  tokenHash: string,
): SessionRecord | null {
  const row = db
    .prepare(
      `SELECT id, user_id, token_hash, created_at, expires_at, revoked_at
       FROM sessions
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .get(tokenHash) as unknown as SessionRecord | undefined;
  return row ? { ...row } : null;
}

/** بترجع true لو فعليًا كانت فيه جلسة نشطة اتلغت الآن، false لو مفيش حاجة تتلغي أصلًا. */
export function revokeSessionByTokenHash(db: DatabaseSync, tokenHash: string): boolean {
  const result = db
    .prepare(
      `UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE token_hash = ? AND revoked_at IS NULL`,
    )
    .run(tokenHash);
  return result.changes > 0;
}

/**
 * (Phase 8) بعد تغيير كلمة السر، بيلغي كل جلسة نشطة تانية لنفس المستخدم —
 * أي جهاز/متصفح تاني داخل بيه هيتطرد ويحتاج يسجّل دخول تاني بكلمة السر
 * الجديدة. الجلسة الحالية (keepTokenHash) مش بتتلغي، عشان اللي غيّر كلمة
 * السر مايتقطعش من نفس الجلسة اللي هو فاتح بيها دلوقتي. بترجع عدد الجلسات
 * اللي فعليًا اتلغت.
 */
export function revokeAllSessionsForUserExceptToken(
  db: DatabaseSync,
  userId: number,
  keepTokenHash: string,
): number {
  const result = db
    .prepare(
      `UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id = ? AND token_hash <> ? AND revoked_at IS NULL`,
    )
    .run(userId, keepTokenHash);
  return Number(result.changes);
}
