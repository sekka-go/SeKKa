import "dotenv/config";
import { createApp } from "./app.js";
import { DEFAULT_DB_PATH, openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { processPoolDeadlines } from "./routes/pool.js";

// ============================================================================
// SeKKa | سِكَّة — Backend
// Phase 1: DB migrations + GET /api/config.
// Phase 2 (Auth Domain): register/login/logout + Session middleware.
// Phase 3 (Captain Profile Domain): captain profile + OTP phone verification.
// Phase 4 (Booking Domain): Daily Commute Request (pickup/dropoff يدوية).
// Phase 5 (Matching Domain): Matching أوتوماتيكي، أقرب كابتن مؤهل.
// Phase 6 (Trip Lifecycle + Payment Ledger): Stops (وصلت)، إقفال الرحلة،
// Payment Ledger Append-only (تأكيد نظامي أوتوماتيك + اعتراض الراكب).
// Phase 7 (Admin & RBAC + Analytics): role='admin' جديد، توثيق الكباتن،
// تعديل التسعير، حل/تعديل/إلغاء الدفعات المعترض عليها، لوحة أرقام عامة.
// Phase 8 (Password Change): POST /auth/change-password لأي مستخدم (rider/
// captain/admin) — كان قيد أمني موثّق من Phase 7 (بما فيها كلمة سر
// الـ Bootstrap admin المكشوفة في 007_admin_rbac.sql).
// Phase 11 (Commute Pool): مستقل عن نموذج matches/trips القديم، مع اشتراكات
// وتذاكر رحلات متكررة، مطابقة الكباتن، الإلغاءات ودفتر تسوية منفصل.
// ============================================================================

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const db = openDatabase(DEFAULT_DB_PATH);
const applied = runMigrations(db);
if (applied.length > 0) {
  // eslint-disable-next-line no-console
  console.log(`[sekka-server] Applied migrations: ${applied.join(", ")}`);
}

const app = createApp(db);

processPoolDeadlines(db);
const poolDeadlineTimer = setInterval(() => processPoolDeadlines(db), 60_000);
poolDeadlineTimer.unref();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[sekka-server] Phase 14 listening on http://localhost:${PORT}`);
});
