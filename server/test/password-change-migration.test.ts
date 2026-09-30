import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

describe("008_password_change.sql", () => {
  it("بيضيف عمود password_changed_at (NULL افتراضيًا) على users من غير ما يمسّ أي عمود قديم", () => {
    const db = freshMigratedDb();

    const result = db
      .prepare(
        `INSERT INTO users (full_name, phone_number, password_hash, role)
         VALUES ('راكب', '01055555555', 'x', 'rider')`,
      )
      .run();
    const userId = Number(result.lastInsertRowid);

    const row = db
      .prepare(
        "SELECT full_name, phone_number, role, password_changed_at FROM users WHERE id = ?",
      )
      .get(userId) as unknown as {
      full_name: string;
      phone_number: string;
      role: string;
      password_changed_at: string | null;
    };

    assert.equal(row.full_name, "راكب");
    assert.equal(row.phone_number, "01055555555");
    assert.equal(row.role, "rider");
    assert.equal(row.password_changed_at, null);
  });

  it("بيسمح بتحديث password_changed_at لتاريخ فعلي (نفس النمط اللي updatePasswordHash هيستخدمه)", () => {
    const db = freshMigratedDb();
    const result = db
      .prepare(
        `INSERT INTO users (full_name, phone_number, password_hash, role)
         VALUES ('كابتن', '01066666666', 'x', 'captain')`,
      )
      .run();
    const userId = Number(result.lastInsertRowid);

    db.prepare(
      "UPDATE users SET password_hash = 'y', password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    ).run(userId);

    const row = db
      .prepare("SELECT password_hash, password_changed_at FROM users WHERE id = ?")
      .get(userId) as unknown as { password_hash: string; password_changed_at: string | null };

    assert.equal(row.password_hash, "y");
    assert.ok(row.password_changed_at, "password_changed_at لازم يبقى له قيمة بعد التحديث");
  });

  it("الـ Bootstrap admin (من Phase 7) لسه موجود بنفس بياناته، وpassword_changed_at بتاعه NULL (لسه ماتغيّرش)", () => {
    const db = freshMigratedDb();
    const row = db
      .prepare("SELECT role, phone_number, password_changed_at FROM users WHERE phone_number = ?")
      .get("+20000000000") as unknown as {
      role: string;
      phone_number: string;
      password_changed_at: string | null;
    };

    assert.equal(row.role, "admin");
    assert.equal(row.password_changed_at, null);
  });
});
