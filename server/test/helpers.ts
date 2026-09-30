import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrate.js";

/** DB منفصلة تمامًا (in-memory) لكل اختبار — مفيش تشارك حالة بين الاختبارات. */
export function freshMigratedDb(): DatabaseSync {
  const db = openDatabase(":memory:");
  runMigrations(db);
  return db;
}
