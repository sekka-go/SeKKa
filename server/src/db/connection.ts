import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * مسار قاعدة البيانات الافتراضي: server/data/sekka.db (يتولّد أول مرة تشتغل).
 * قابل للتغيير عبر SEKKA_DB_PATH (مفيد للاختبارات: ":memory:").
 */
export const DEFAULT_DB_PATH =
  process.env.SEKKA_DB_PATH ?? path.join(process.cwd(), "data", "sekka.db");

export function openDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new DatabaseSync(dbPath);
  // FK enforcement مش مفعّلة افتراضيًا في SQLite — لازم تتفعّل لكل Connection.
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}
