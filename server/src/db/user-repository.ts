import type { DatabaseSync } from "node:sqlite";

// 'admin' اتضاف في Phase 7 (007_admin_rbac.sql) — مفيش مسار تسجيل عام ليه
// (POST /auth/register لسه محصور rider/captain عمدًا)، حساب واحد بس مزروع
// (Bootstrap) عبر الـ Migration نفسها.
export type UserRole = "rider" | "captain" | "admin";

export interface UserRecord {
  id: number;
  full_name: string;
  phone_number: string;
  password_hash: string;
  role: UserRole;
  verified_at: string | null;
  created_at: string;
  // اتضاف في Phase 8 (008_password_change.sql) — NULL يعني كلمة السر لسه
  // زي ما اتسجّلت أول مرة (register أو Bootstrap admin)، مش قيمة إجبارية.
  password_changed_at: string | null;
}

export type PublicUser = Omit<UserRecord, "password_hash">;

export function toPublicUser(user: UserRecord): PublicUser {
  const { password_hash: _password_hash, ...publicUser } = user;
  return publicUser;
}

const USER_COLUMNS =
  "id, full_name, phone_number, password_hash, role, verified_at, created_at, password_changed_at";

export function findUserByPhoneNumber(db: DatabaseSync, phoneNumber: string): UserRecord | null {
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE phone_number = ?`)
    .get(phoneNumber) as unknown as UserRecord | undefined;
  return row ? { ...row } : null;
}

export function findUserById(db: DatabaseSync, id: number): UserRecord | null {
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as unknown as UserRecord | undefined;
  return row ? { ...row } : null;
}

/**
 * بتحدّث password_hash وpassword_changed_at (Phase 8) — مسؤولية الـ Route
 * إنه يتحقق من كلمة السر الحالية الأول (verifyPassword)، الدالة دي بتفترض
 * إن الـ hash الجديد اتجهّز فعلًا (hashPassword) قبل ما توصلها.
 */
export function updatePasswordHash(db: DatabaseSync, userId: number, newPasswordHash: string): UserRecord | null {
  db.prepare(
    "UPDATE users SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  ).run(newPasswordHash, userId);
  return findUserById(db, userId);
}

/** بتحدّث verified_at للوقت الحالي (Phase 3 — بعد تأكيد OTP ناجح فقط). */
export function markUserVerified(db: DatabaseSync, userId: number): UserRecord | null {
  db.prepare(
    "UPDATE users SET verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  ).run(userId);
  return findUserById(db, userId);
}

export interface CreateUserInput {
  full_name: string;
  phone_number: string;
  password_hash: string;
  role: UserRole;
}

/**
 * بترجع الصف الكامل بعد الإدخال. بترمي أي خطأ SQLite زي هو (زي UNIQUE
 * constraint على phone_number) — المسؤولية على الـ Route إنه يفسّرها لرسالة
 * عربية مناسبة، مش هنا.
 */
export function createUser(db: DatabaseSync, input: CreateUserInput): UserRecord {
  const result = db
    .prepare(
      "INSERT INTO users (full_name, phone_number, password_hash, role) VALUES (?, ?, ?, ?)",
    )
    .run(input.full_name, input.phone_number, input.password_hash, input.role);

  const created = findUserById(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("فشل غير متوقع بعد إنشاء المستخدم.");
  }
  return created;
}
