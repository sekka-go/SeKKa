import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

describe("Migration 002_auth", () => {
  it("جدول users فيه أعمدة Auth الجديدة", () => {
    const db = freshMigratedDb();
    const columns = (
      db.prepare("PRAGMA table_info(users)").all() as unknown as { name: string }[]
    ).map((c) => c.name);
    assert.deepEqual(
      columns.sort(),
      [
        "created_at",
        "full_name",
        "id",
        "password_changed_at",
        "password_hash",
        "phone_number",
        "role",
        "verified_at",
      ].sort(),
    );
  });

  it("جدول sessions اتبنى بالأعمدة المطلوبة", () => {
    const db = freshMigratedDb();
    const columns = (
      db.prepare("PRAGMA table_info(sessions)").all() as unknown as { name: string }[]
    ).map((c) => c.name);
    assert.deepEqual(
      columns.sort(),
      ["created_at", "expires_at", "id", "revoked_at", "token_hash", "user_id"].sort(),
    );
  });

  // ملحوظة (Phase 7): 'admin' بقى role مسموح فعليًا على مستوى الـ DB من
  // 007_admin_rbac.sql (مفيش مسار تسجيل عام ليه عبر POST /auth/register
  // برضه — لسه محصور rider/captain هناك عمدًا، راجع HANDOFF.md بتاع Phase
  // 7). الاختبار ده بقى بيتأكد إن القيم الثلاث المسموحة (rider/captain/
  // admin) بس هي المقبولة، وأي قيمة تانية (زي 'elite') لسه مرفوضة.
  it("يرفض role غير rider/captain/admin على مستوى الـ DB (CHECK)", () => {
    const db = freshMigratedDb();
    assert.throws(() => {
      db.exec(`
        INSERT INTO users (full_name, phone_number, password_hash, role)
        VALUES ('X', '01000000000', 'hash', 'elite')
      `);
    });
  });

  it("يقبل role admin على مستوى الـ DB بعد Phase 7 (007_admin_rbac.sql)", () => {
    const db = freshMigratedDb();
    assert.doesNotThrow(() => {
      db.exec(`
        INSERT INTO users (full_name, phone_number, password_hash, role)
        VALUES ('أدمن تاني', '01000000005', 'hash', 'admin')
      `);
    });
  });

  it("يقبل role rider و captain بالظبط", () => {
    const db = freshMigratedDb();
    assert.doesNotThrow(() => {
      db.exec(`
        INSERT INTO users (full_name, phone_number, password_hash, role)
        VALUES ('راكب', '01000000002', 'hash', 'rider')
      `);
      db.exec(`
        INSERT INTO users (full_name, phone_number, password_hash, role)
        VALUES ('كابتن', '01000000003', 'hash', 'captain')
      `);
    });
  });

  it("verified_at بيفضل NULL افتراضيًا", () => {
    const db = freshMigratedDb();
    db.exec(`
      INSERT INTO users (full_name, phone_number, password_hash, role)
      VALUES ('راكب', '01000000004', 'hash', 'rider')
    `);
    const row = db
      .prepare("SELECT verified_at FROM users WHERE phone_number = ?")
      .get("01000000004") as unknown as { verified_at: string | null };
    assert.equal(row.verified_at, null);
  });
});
