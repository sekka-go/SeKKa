import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import {
  createUser,
  findUserById,
  findUserByPhoneNumber,
  toPublicUser,
  updatePasswordHash,
  type UserRole,
} from "../db/user-repository.js";
import {
  createSession,
  revokeAllSessionsForUserExceptToken,
  revokeSessionByTokenHash,
} from "../db/session-repository.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { generateSessionToken, hashSessionToken } from "../security/session-token.js";
import { requireAuth } from "../middleware/require-auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

const ALLOWED_ROLES: UserRole[] = ["rider", "captain"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// رسالة فشل الدخول العامة — عمدًا نفس الرسالة سواء الرقم مش موجود أو كلمة
// السر غلط، عشان محدش يقدر يكتشف وجود حساب من عدمه من الرد.
const GENERIC_LOGIN_FAILURE = "رقم الهاتف أو كلمة السر غلط.";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_FULL_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 32;

// (Phase 9) حماية بسيطة من محاولات التخمين المتكررة (Brute-force) على
// login وchange-password — القيد الأمني ده كان موثّق كفجوة مفتوحة من Phase
// 8 (ومن قبلها). 5 محاولات/15 دقيقة قيمة بداية معقولة (زي حد الـ 8 حروف في
// كلمة السر: Placeholder قابل للمراجعة، مش معيار نهائي).
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 5;
const REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MESSAGE = "محاولات كتير في وقت قصير. حاول تاني بعد شوية.";

export function createAuthRouter(db: DatabaseSync): Router {
  const router = Router();

  const registerIpRateLimiter = createRateLimiter({
    windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
    max: 100,
    keyFn: (req) => `ip:${req.ip ?? "unknown"}`,
    message: "تم إنشاء حسابات كثيرة من هذا الاتصال. حاول بعد قليل.",
  });
  const registerPhoneRateLimiter = createRateLimiter({
    windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
    max: 5,
    keyFn: (req) => `phone:${typeof req.body?.phone_number === "string" ? req.body.phone_number.trim() : ""}`,
    message: "وصلت للحد المؤقت لإنشاء حساب بهذا الرقم. حاول بعد قليل.",
  });

  // المفتاح = IP + رقم الهاتف المُرسَل (مش IP لوحده) — عشان مهاجم من IP
  // واحد يقدر يستهدف أكتر من رقم برضه يتحد لكل رقم على حدة، ومفيش حد واحد
  // على IP بيأثر على كل المستخدمين اللي وراه (NAT/شبكة مشتركة). لو
  // phone_number مش String سليم، بيقع في مفتاح واحد مشترك بردّ 400 عادي
  // قبل حتى الوصول هنا فعليًا (مفيش استهلاك محاولات فاضي).
  const loginRateLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    keyFn: (req) => `${req.ip ?? "unknown"}:${typeof req.body?.phone_number === "string" ? req.body.phone_number : ""}`,
    message: RATE_LIMIT_MESSAGE,
  });

  // هنا بعد requireAuth، فالمفتاح بقى userId فعلي (مش IP) — بيحمي تحديدًا
  // من تخمين current_password بتاع حساب معروف مسبقًا (الهجوم المحتمل هنا
  // مختلف عن login: المهاجم عنده Session شغالة بالفعل، وبيحاول يعرف كلمة
  // السر الحالية).
  const changePasswordRateLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    keyFn: (req) => `user:${req.auth!.userId}`,
    message: RATE_LIMIT_MESSAGE,
  });

  router.post("/auth/register", registerIpRateLimiter, registerPhoneRateLimiter, (req, res) => {
    const { full_name, phone_number, password, role } = req.body ?? {};

    if (
      !isNonEmptyString(full_name) ||
      !isNonEmptyString(phone_number) ||
      !isNonEmptyString(password) ||
      full_name.trim().length > MAX_FULL_NAME_LENGTH ||
      phone_number.trim().length > MAX_PHONE_LENGTH ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      res.status(400).json({ error: "بيانات الحساب غير صحيحة. تأكد من الاسم ورقم الهاتف وطول كلمة السر." });
      return;
    }

    if (!isNonEmptyString(role) || !ALLOWED_ROLES.includes(role as UserRole)) {
      // بيرفض أي role تاني (بما فيها أي حاجة اسمها "elite") — مسموح بس
      // rider/captain، زي ما الـ CHECK constraint في DB بيفرضه كمان.
      res.status(400).json({ error: "نوع الحساب المطلوب مش متاح." });
      return;
    }

    const existing = findUserByPhoneNumber(db, phone_number);
    if (existing) {
      res.status(409).json({ error: "الرقم ده مسجّل قبل كده." });
      return;
    }

    try {
      const user = createUser(db, {
        full_name,
        phone_number,
        password_hash: hashPassword(password),
        role: role as UserRole,
      });
      res.status(201).json({ user: toPublicUser(user) });
    } catch {
      // دفاع إضافي لو حصل Race condition بين فحص التكرار والإدخال (Unique
      // constraint في DB هيرفضه برضه) — نفس الرسالة، بدون تفاصيل SQL.
      res.status(409).json({ error: "الرقم ده مسجّل قبل كده." });
    }
  });

  router.post("/auth/login", loginRateLimiter, (req, res) => {
    const { phone_number, password } = req.body ?? {};

    if (!isNonEmptyString(phone_number) || !isNonEmptyString(password) || phone_number.length > MAX_PHONE_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      res.status(400).json({ error: GENERIC_LOGIN_FAILURE });
      return;
    }

    const user = findUserByPhoneNumber(db, phone_number);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: GENERIC_LOGIN_FAILURE });
      return;
    }

    const token = generateSessionToken();
    createSession(db, user.id, hashSessionToken(token));

    res.status(200).json({ token, user: toPublicUser(user) });
  });

  router.post("/auth/logout", requireAuth(db), (req, res) => {
    revokeSessionByTokenHash(db, req.auth!.tokenHash);
    res.status(200).json({ success: true });
  });

  router.get("/auth/me", requireAuth(db), (req, res) => {
    const user = findUserById(db, req.auth!.userId);
    if (!user) {
      res.status(401).json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." });
      return;
    }
    res.status(200).json({ user: toPublicUser(user) });
  });

  // (Phase 8) بديل عام لأي مستخدم (rider/captain/admin) يغيّر كلمة سره
  // بنفسه — مفيش Endpoint كان بيعمل ده قبل كده في أي Phase سابقة (كان قيد
  // موثّق في HANDOFF بتاع Phase 7). مفيش requireRole هنا عمدًا: أي مستخدم
  // مسجّل دخول يقدر يغيّر كلمة سره هو بس (req.auth!.userId)، مش أي حساب
  // تاني — ده مش Endpoint إداري.
  router.post("/auth/change-password", requireAuth(db), changePasswordRateLimiter, (req, res) => {
    const { current_password, new_password } = req.body ?? {};

    if (!isNonEmptyString(current_password) || !isNonEmptyString(new_password) || current_password.length > MAX_PASSWORD_LENGTH || new_password.length > MAX_PASSWORD_LENGTH) {
      res.status(400).json({ error: "لازم تكتب كلمة السر الحالية والجديدة." });
      return;
    }

    if (new_password.length < MIN_PASSWORD_LENGTH) {
      res
        .status(400)
        .json({ error: `كلمة السر الجديدة لازم تكون ${MIN_PASSWORD_LENGTH} حروف على الأقل.` });
      return;
    }

    const user = findUserById(db, req.auth!.userId);
    if (!user) {
      // نظريًا مستحيل (لو الـ Session شغالة لازم يكون المستخدم موجود)، لكن
      // دفاع صريح بدل افتراض ضمني.
      res.status(401).json({ error: "لازم تسجّل الدخول الأول." });
      return;
    }

    if (!verifyPassword(current_password, user.password_hash)) {
      res.status(401).json({ error: "كلمة السر الحالية غلط." });
      return;
    }

    if (new_password === current_password) {
      res.status(400).json({ error: "كلمة السر الجديدة لازم تكون مختلفة عن الحالية." });
      return;
    }

    updatePasswordHash(db, user.id, hashPassword(new_password));

    // الجلسة الحالية (اللي بيبعت منها الطلب ده) فضلة شغالة — أي جلسة تانية
    // لنفس المستخدم (جهاز/متصفح تاني) بتتلغي فورًا.
    const revokedOtherSessions = revokeAllSessionsForUserExceptToken(
      db,
      user.id,
      req.auth!.tokenHash,
    );

    res.status(200).json({ success: true, revoked_other_sessions: revokedOtherSessions });
  });

  return router;
}
