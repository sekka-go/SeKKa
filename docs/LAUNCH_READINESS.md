# SeKKa Launch Readiness — Stage 1 Go / No-Go Audit

Date: 2026-10-31
Scope: read-only review for the current repository state and the deployed Supabase/Cloudflare setup, before any staging or production change. This document follows the commitment not to change production data, migrations, functions, or Pages config without explicit written approval.

## Status legend

- ✅ Ready
- ⚠️ Partial / needs follow-up
- ❌ Blocker
- ❓ Cannot verify from the current repo/access

---

## A) Product and PRD 6.1 compliance

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| تسجيل → دخول → عرض/بحث → طلب انضمام | ❌ Blocker | `docs/SCHEMA_DRIFT.md` confirms `public.captain_line_join_requests` is absent from the live schema, and the local migration expects it. The current UI and API contract were not verified with a live join-request table. | يجب وجود جدول/endpoint/واجهة فعليّين لطلب الانضمام قبل أي إطلاق. |
| PRD 6.1: لا دفع/اشتراكات/نزاعات مالية داخل التطبيق | ⚠️ Partial | The codebase still contains screens/labels around subscriptions, payment flows, complaints, and dispute-style flows, but the report explicitly notes these are not integrated as live product actions. `RiderJourneyScreen` and `CaptainJourneyScreen` show “not active” notices rather than real write flows. | نحتاج اتفاق واضح: هل سنبقيها كواجهة غير مفعّلة أم سنزيلها من المنتج؟ |
| لا يوجد نص يحوي “آمن / مضمون / موثوق” | ✅ Ready | Repo search for the prohibited words returned no matches in the relevant web sources after the UI tone cleanup. | الاحتفاظ بهكذا في كل نص جديد. |
| الشكاوى والبلاغات في الواقع | ❌ Blocker | The app still exposes complaint actions that fail with a “not enabled” message. No real support channel is linked in the app; the flow is not live. | إما دعم فعلي واضح (قناة تواصل)، أو اعتبارها blocker. |
| شاشات الإدارة: اعتماد الكابتن / مراجعة الوثائق / إيقاف الحسابات | ❠ Partial / blocker | No end-to-end proof of live admin approval/rejection, document review, and account suspension with audit state. `AdminConsoleLiveScreen` exists as a shell but not validated against a live admin workflow. | نحتاج live admin access + audit log + reason record قبل أي إطلاق. |
| المسارات الأساسية | ⚠️ Partial | The repo contains the implemented UI flow shells, but the live API contract is not fully verified with real test data. | تثبيت happy path على staging قبل أي قرار إطلاق. |

---

## B) Security

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| `verify_jwt = false` في Supabase config | ⚠️ Partial | `supabase/config.toml` contains `verify_jwt = false` and the function uses custom auth logic; this means the custom verification must be reviewed carefully. | مراجعة كل route for bearer validation, role checks, ownership checks, and token expiry/revocation. |
| مصادقة مخصصة داخل Edge Function | ⚠️ Partial | `supabase/functions/sekka-api/index.ts` contains custom handlers and token checks, but the full auth flow was not audited end-to-end in this read-only pass. | فحص شامل لرموز الـ JWT والـ session و role و ownership داخل الدالة. |
| password hashing | ❓ Cannot verify | No explicit repository proof was read for the bcrypt/argon2 hashing implementation in the backend function or DB schema. | أحتاج الوصول إلى live function + schema و/أو تسجيلات التشفير. |
| rate limiting على login/register/password reset | ⚠️ Partial | The function includes `sekka_take_rate_limit` and rate limits for password reset and Telegram verification. This is present in code, but live enforcement needs test verification. | اختبار ضغوط + حدود الأوامر في staging. |
| CORS و `SEKKA_ALLOWED_ORIGINS` | ⚠️ Partial | `supabase/functions/sekka-api/cors.ts` and the function handle origin restrictions. However there is no production environment verification or audit of the current allowlist. | يجب التحقق من صحيح الأ origins لكل بيئة. |
| `web/public/_headers` | ❌ Missing | No `web/public/_headers` file was found in the workspace. | أضف/راجع رؤوس الأمان على Pages قبل الإطلاق. |
| أسرار / tokens / keys في الريبو | ✅ No live secrets in repo | `git grep` showed only variable names in `.env.example` and code references; no actual secret values were found in the checked repo state. | لا يُسمح بإدراج أي قيمة سر في الملفات أو الـ logs أو الـ commit. |
| كشف secret سابقًا | ❓ Need confirmation | The user explicitly said: if a secret was exposed earlier, inform them and stop. No actual secret values were found in the repo state reviewed here, but the live environment was not inspected. | أحتاج تأكيدًا من صاحب المشروع إن كان هناك access token/service key تم كشفه خارج هذا الريبو. |
| `npm audit` | ✅ Ready | `cd web && npm audit --omit=dev --json` returned zero vulnerabilities in the checked dependency set. | استمرار المراجعة عند أي تحديثات جديدة. |
| LocalStorage session risk | ⚠️ Partial | The app stores session tokens in local storage; this is a known risk pattern. It is not proof of vulnerability by itself, but it must be documented and reviewed. | نحتاج سياسة واضحة: TTL، revoke، logout، و disclosure في مستند الأمان. |

---

## C) Database and schema readiness

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| Drift بين schema المحلي والإنتاج | ❌ Blocker | `docs/SCHEMA_DRIFT.md` states the live schema differs from the local migration history; `captain_line_join_requests` is absent in the live exported schema. | لا يفتح إطلاق إلا بعد baseline + reconcile strategy. |
| Baseline staging from scratch | ❌ Blocker | No baseline migration was verified as safe to replay against a fresh staging project. | يجب إنتاج baseline واضح مع قرار: هل `20261030133000...` يدخل في baseline أم يُعاد بناء؟ |
| RLS و grants | ❓ Cannot verify | The repo includes migration references to `service_role`, but no live dump or policy audit was run in this pass. | أحتاج live dump / عينة policies أو access إلى Supabase dashboard. |
| Indexes الأساسية | ❓ Cannot verify | No live query plan or migration review was verified here. | يجب مراجعة search / requests / messages / notifications indexes في staging. |
| PITR / backup | ❓ Cannot verify | Not confirmed from repo or env access. | أحتاج تأكيد dashboard أو provider status. |
| Rollback plan | ⚠️ Partial | A rollback strategy was discussed conceptually but not fully documented in code. | تحتاج SQL reverse plan و strategy for Pages rollback + function rollback. |

---

## D) Quality and verification

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| Web typecheck/test/build | ✅ Ready | Fresh command: `cd /workspaces/SeKKa/web && npm run typecheck && npm test && npm run build` passed. | احتفظ بالنتيجة في سجل الإطلاق. |
| Bundle size | ⚠️ Partial | Build succeeded, but the bundle is large. This is not a blocker by itself, but it needs performance watch. | احتساب budget + lazy loading review قبل beta تلقائي. |
| Dead code / broken imports | ⚠️ Partial | The repo contains legacy references and some dead or unsupported flows; not all are blocked but they need explicit classification. | مراجعة imports و routes unused قبل فتح beta. |
| Tests coverage | ⚠️ Partial | There are tests for some logic, but no full E2E and no production-like smoke flow for the critical user journey. | أدنى smoke tests في staging قبل launch. |
| Mobile / RTL / touch targets | ⚠️ Partial | The current app is RTL-oriented and the CSS is designed for mobile, but no real 375px regression check was run in this read-only pass. | تنفيذ smoke check real device / browser emulation. |
| Accessibility basics | ⚠️ Partial | Some `aria-label`s exist, but a full pass for contrast, keyboard focus, and dialog semantics was not verified. | فحص A11y قبل beta. |

---

## E) Legal, operational readiness

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| الشروط والخصوصية | ⚠️ Partial | The legal pages exist and remain formal; however their match to actual data collection and behavior was not fully verified. | مراجعة كل نقطة جمع/حفظ/تمرير بيانات: رقم الهاتف، الموقع، المستندات، Telegram. |
| قبول الشروط وتاريخ الإصدار | ❓ Cannot verify | No live policy-version audit was reviewed here. | تحتاج تسجيل واضح في التطبيق + DB or audit table. |
| Support / channel | ❌ Blocker | No clear user-support channel was identified in the repo for the unsupported complaint flow. | نحتاج قناة دعم واضحة + SLA + من يجيب على الشكاوى. |
| 404 / error / maintenance pages | ❓ Cannot verify | No live Pages configuration or maintenance page was reviewed. | تحتاج صفحات error + maintenance + robots + domain SSL. |
| Monitoring | ❓ Cannot verify | No live Cloudflare/ Supabase logs or error monitoring were reviewed in this pass. | تحتاج dashboard log + alert threshold. |
| Domain / SSL / redirect / OG tags | ❓ Cannot verify | The repo has HTML metadata but no live production domain or Cloudflare config verification. | أحتاج تأكيد النطاق + SSL + redirect. |

---

## F) Environment readiness

| بند | الحالة | الدليل | المطلوب |
|---|---|---|---|
| Staging environment | ❌ Blocker | No staging project or branch deployment was verified in this pass. The instructions explicitly forbid production changes without an explicit approval phrase. | مطلوب staging منفصل قبل أي launch decision. |
| env vars table | ❠ Partial | The repo includes `.env.example` with secret names, but the live env values were not available. | أحتاج جدول باسماء المتغيرات لكل بيئة، بدون قيم. |
| Nominatim / Photon / OSRM policy | ⚠️ Partial | Code uses public geocoding APIs with clear rate-limiting and bounded Cairo checks in the function. However fair-use policy and production availability need explicit review. | تأكيد سياسات الاستخدام العادل + fallback/ cache strategy. |

---

## Quick summary of findings

- The repository is not launch-ready for production as-is.
- The most important blocker is the missing live join-request contract (`captain_line_join_requests` absent in the exported schema), which makes the core rider-to-captain flow unverified.
- The environment and staging story is not verified: no live staging project, no live admin workflow proof, no production support flow, and no clear domain/monitoring audit.
- The web app itself compiles and tests locally, which is a positive sign, but local green checks do not override backend/schema readiness blockers.

---

## Preliminary decision

### Decision: NO-GO for production launch

Reason:

1. The core join-request flow is not verified at the API + database + UI level.
2. The live schema and migration history are out of sync; this is a real risk for rollout and rollback.
3. No staging environment or live admin workflow was verified.
4. Complaint/support and other protected flows are not live or are clearly not enabled.
5. Production secrets, monitoring, and support responsibilities were not validated from the live environment.

This is not a “code quality” failure; it is a readiness risk. The code can be improved and tested further, but the launch gate should remain closed until the blockers are resolved and a staging environment is proven.

---

## Blockers ranked by priority

| الأولوية | الـ blocker | الحل | الجهد التقريبي | المسؤول |
|---|---|---|---|---|
| P0 | Missing live join-request table + API contract | Reconcile database schema, create the missing contract, validate rider/captain flow in staging | 3–5 أيام | كودكس + أنا |
| P0 | No verified staging environment | Create separate Supabase staging project and Pages preview branch | 1–2 أيام | كودكس + أنا |
| P0 | No verified admin approval / document review / account suspension flow | Implement and test real admin operations with reason + audit trail | 2–4 أيام | كودكس + أنا |
| P1 | Complaint support / support channel not active | Replace with a real support path or explicit external contact flow | 1 يوم | كودكس + أنا |
| P1 | No verified database baseline rollback plan | Produce baseline + migration rollback and test restore path | 2–3 أيام | كودكس + أنا |
| P1 | Missing production monitoring/alerting | Configure error logs, alerts, and health checks | 1–2 أيام | كودكس + أنا |
| P2 | Security / custom auth and session review | Audit custom bearer validation, revoke policy, and CORS on staging | 2–3 أيام | كودكس + أنا |
| P2 | No live `_headers` and hardening review | Add CSP and security headers on Pages / proxy | 0.5–1 يوم | كودكس |

---

## Decisions required from the owner / product team

- Do we treat the join-request flow as a hard launch blocker before any public beta?
- Is Telegram the official password-recovery channel for production, or do we require another path?
- What is the official support channel for complaints and account issues?
- Is the staging project already available, or should we create it first before continuing the launch work?
- Can you confirm whether any earlier exposed secret was actually used or rotated?
- Do we keep the unsupported payment/subscription/financial screens hidden or remove them from the product flow?
- Should the launch target be a closed beta or a full public open market launch?

---

## Bottom line

This repository state is not production-ready. The app is promising locally, and the codebase has a good front-end build/test baseline, but the product readiness gate is blocked by schema drift, no verified join-request flow, no staging environment, and no confirmed live support/admin operations. The next correct action is staging verification and database reconciliation, not production deployment.

If you want me to continue, the next allowed step is to proceed only to Stage 2 after you explicitly say: "كمّل للمرحلة 2".
