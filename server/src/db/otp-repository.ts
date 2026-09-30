import type { DatabaseSync } from "node:sqlite";

export type OtpPurpose = "phone_verification";

export interface OtpChallengeRecord {
  id: number;
  user_id: number;
  otp_hash: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  purpose: OtpPurpose;
}

export function createOtpChallenge(
  db: DatabaseSync,
  userId: number,
  otpHash: string,
  expiresAt: string,
  purpose: OtpPurpose = "phone_verification",
): OtpChallengeRecord {
  db.prepare(
    "INSERT INTO otp_challenges (user_id, otp_hash, expires_at, purpose) VALUES (?, ?, ?, ?)",
  ).run(userId, otpHash, expiresAt, purpose);

  const row = db
    .prepare(
      `SELECT id, user_id, otp_hash, created_at, expires_at, consumed_at, purpose
       FROM otp_challenges WHERE id = last_insert_rowid()`,
    )
    .get() as unknown as OtpChallengeRecord;
  return { ...row };
}

/** آخر Challenge لسه صالح (مش مستهلك، ولسه ماخلصتش صلاحيته) لنفس المستخدم والغرض. */
export function findLatestActiveOtpChallenge(
  db: DatabaseSync,
  userId: number,
  purpose: OtpPurpose = "phone_verification",
): OtpChallengeRecord | null {
  const row = db
    .prepare(
      `SELECT id, user_id, otp_hash, created_at, expires_at, consumed_at, purpose
       FROM otp_challenges
       WHERE user_id = ?
         AND purpose = ?
         AND consumed_at IS NULL
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(userId, purpose) as unknown as OtpChallengeRecord | undefined;
  return row ? { ...row } : null;
}

/** بيعلّم الـ Challenge كمُستهلك (Append-only manner) — بيرجّع true لو فعليًا كان لسه مش مستهلك. */
export function consumeOtpChallenge(db: DatabaseSync, id: number): boolean {
  const result = db
    .prepare(
      `UPDATE otp_challenges SET consumed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND consumed_at IS NULL`,
    )
    .run(id);
  return result.changes > 0;
}
