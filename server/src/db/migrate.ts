import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** server/migrations — كل ملف .sql مرقّم، يتطبّق مرة واحدة بس وبالترتيب. */
export const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

interface MigrationRow {
  filename: string;
}

/**
 * يطبّق أي migration جديد (لسه ماتسجّلش في schema_migrations) بالترتيب
 * الأبجدي لاسم الملف (001_..., 002_..., ...)، كل ملف جوه Transaction واحدة.
 * ممنوع تعديل ملف اتطبّق قبل كده — لو الملف موجود في schema_migrations
 * بيتجاهل تمامًا حتى لو محتواه اتغيّر.
 *
 * بيرجّع أسماء الملفات اللي اتطبّقت فعليًا في هذا الاستدعاء (فاضية لو كل حاجة
 * كانت متطبّقة أصلاً).
 */
export function runMigrations(
  db: DatabaseSync,
  migrationsDir: string = MIGRATIONS_DIR,
): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const alreadyApplied = new Set(
    (db.prepare("SELECT filename FROM schema_migrations").all() as unknown as MigrationRow[]).map(
      (row) => row.filename,
    ),
  );

  const pendingFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !alreadyApplied.has(f));

  const newlyApplied: string[] = [];

  for (const filename of pendingFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf-8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(filename);
      db.exec("COMMIT");
      newlyApplied.push(filename);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${filename} فشلت: ${(err as Error).message}`);
    }
  }

  return newlyApplied;
}
