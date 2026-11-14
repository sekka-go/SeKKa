# seKKa — Phase 2 independent UI/UX acceptance

Date: 2026-11-15. Branch: `audit/uiux-phase2-20261115`. Baseline: `48b36240d966660b6733da21d1ce64eb1ed44ce5` (main at start). Canonical authority: `docs/PRD.md` v3.1, **73 public screens / 8 PRD stages**.

## Scope and honesty

This begins the independent Phase 2 audit; it is **not** a signed-off visual review. Repository source and prior test documentation were inspected, but no live browser screenshots, real mobile device runs, screen-reader runs, or fresh CI run were performed for this report. All 73 statuses start at **Not independently reviewed**. Existing automated route coverage does not prove UX acceptance. No backend or financial functionality is claimed.

## Evidence inspected and initial risks

- `web/src/v2/screenMap.ts`: 73 public titles and internal view mapping are present. A screen's presence does not verify its interactive and visual states.
- `web/src/v2/theme.css`: shared tokens and light-theme overrides, a 900px responsive breakpoint, a 420px breakpoint, visible focus outlines, 46px default button min-height, and reduced-motion handling. These are positive source-level signals, not measured contrast or mobile screenshot proof.
- `docs/ACTIVE_GAPS_V31.md`: expressly flags incomplete bilingual/light/dark visual audit, assistive technology review, and every-control failure/retry/back-navigation coverage.
- `docs/IMPLEMENTATION_STATUS.md`: notes dynamic translated copy, visual layouts and real-device bilingual acceptance remain incomplete, and all finance and authentication are simulations.
- `docs/UX_ACTIONABILITY_PROGRESS.md`: targeted actions were repaired but an exhaustive review of controls and states remains open.
- Last main commit message reports 46 Playwright tests passing for the PR #182 scope; this does not constitute a new Phase 2 test run or all-screen signoff.

## Mandatory per-screen matrix

For every one of 73 screens: review Arabic RTL and English LTR, each in system/default and manual Light/Dark theme, on 320px, 375px, 390px and 768px viewports, plus desktop when applicable. Record screenshots for normal, loading, empty, error, success, disabled and prerequisite states where applicable; test labels, focus order, touch targets, clipping/overflow, buttons, back behavior, preservation of draft, status language, contrast and reduced motion. Mark N/A explicitly instead of assuming pass.

## Severity policy

P0: data/security/financial misleading action or blocked critical journey. P1: nonfunctional CTA, impossible recovery, incorrect stop direction or pricing representation, lost draft, untranslated blocking UI. P2: clipping, contrast, typography, spacing, inconsistent hierarchy, noncritical translation. P3: minor polish.

## Screen-by-screen acceptance register

| Public ID | Canonical Arabic title | Area | Independent visual/UX verdict |
|---:|---|---|---|
| 1 | البداية | Onboarding | Not independently reviewed |
| 2 | الترحيب | Onboarding | Not independently reviewed |
| 3 | اختيار نوع الحساب | Onboarding | Not independently reviewed |
| 4 | رقم الموبايل | Onboarding | Not independently reviewed |
| 5 | التحقق من الكود | Onboarding | Not independently reviewed |
| 6 | استكمال الملف الشخصي | Onboarding | Not independently reviewed |
| 7 | الأذونات | Onboarding | Not independently reviewed |
| 8 | الرئيسية للراكب | Rider | Not independently reviewed |
| 9 | البحث عن خط | Rider | Not independently reviewed |
| 10 | فلاتر البحث | Rider | Not independently reviewed |
| 11 | نتائج البحث | Rider | Not independently reviewed |
| 12 | تفاصيل الخط | Rider | Not independently reviewed |
| 13 | المفضلة | Rider | Not independently reviewed |
| 14 | مراجعة طلب رحلة | Rider | Not independently reviewed |
| 15 | ملخص الحجز والتكلفة النهائية | Rider | Not independently reviewed |
| 16 | تأمين الحجز | Rider | Not independently reviewed |
| 17 | تم تأكيد الحجز | Rider | Not independently reviewed |
| 18 | تفاصيل اشتراكي | Rider | Not independently reviewed |
| 19 | تأكيد دفع الاشتراك | Rider | Not independently reviewed |
| 20 | حالة تأكيد الاستلام | Rider | Not independently reviewed |
| 21 | إدارة الاشتراك | Rider | Not independently reviewed |
| 22 | المحفظة | Rider | Not independently reviewed |
| 23 | شحن المحفظة | Rider | Not independently reviewed |
| 24 | نتيجة الشحن | Rider | Not independently reviewed |
| 25 | سحب الرصيد | Rider | Not independently reviewed |
| 26 | سجل المعاملات | Rider | Not independently reviewed |
| 27 | اشتراكاتي | Rider | Not independently reviewed |
| 28 | سجل الاشتراكات السابقة | Rider | Not independently reviewed |
| 29 | المحادثات | Rider | Not independently reviewed |
| 30 | المحادثة | Rider | Not independently reviewed |
| 31 | الإشعارات | Rider | Not independently reviewed |
| 32 | حسابي | Rider | Not independently reviewed |
| 33 | تعديل البيانات الشخصية | Rider | Not independently reviewed |
| 34 | المساعدة والدعم | Rider | Not independently reviewed |
| 35 | بداية تسجيل الكابتن | Captain onboarding | Not independently reviewed |
| 36 | بيانات الكابتن | Captain onboarding | Not independently reviewed |
| 37 | بيانات العربية | Captain onboarding | Not independently reviewed |
| 38 | رفع المستندات | Captain onboarding | Not independently reviewed |
| 39 | مراجعة الطلب | Captain onboarding | Not independently reviewed |
| 40 | حالة مراجعة الحساب | Captain onboarding | Not independently reviewed |
| 41 | تفعيل حساب الكابتن | Captain onboarding | Not independently reviewed |
| 42 | خطوطي | Captain routes | Not independently reviewed |
| 43 | إنشاء خط جديد | Captain routes | Not independently reviewed |
| 44 | تحديد المسار | Captain routes | Not independently reviewed |
| 45 | تحديد المواعيد | Captain routes | Not independently reviewed |
| 46 | نوع الاشتراك واتجاهه | Captain routes | Not independently reviewed |
| 47 | السعر والمقاعد | Captain routes | Not independently reviewed |
| 48 | مراجعة ونشر العرض | Captain routes | Not independently reviewed |
| 49 | إدارة الخط وتعديله | Captain routes | Not independently reviewed |
| 50 | الرئيسية للكابتن | Captain operations | Not independently reviewed |
| 51 | الحجوزات الجديدة | Captain operations | Not independently reviewed |
| 52 | قائمة المشتركين | Captain operations | Not independently reviewed |
| 53 | تفاصيل اشتراك راكب | Captain operations | Not independently reviewed |
| 54 | التشغيل اليومي | Captain operations | Not independently reviewed |
| 55 | تأكيد استلام الاشتراك | Captain operations | Not independently reviewed |
| 56 | المحادثات | Captain operations | Not independently reviewed |
| 57 | المحادثة مع الراكب | Captain operations | Not independently reviewed |
| 58 | إشعارات الكابتن | Captain operations | Not independently reviewed |
| 59 | الحساب المالي والمعاملات | Captain operations | Not independently reviewed |
| 60 | حساب الكابتن | Captain operations | Not independently reviewed |
| 61 | الدعم والمساعدة | Captain operations | Not independently reviewed |
| 62 | لوحة التحكم | Admin | Not independently reviewed |
| 63 | إدارة المستخدمين | Admin | Not independently reviewed |
| 64 | إدارة الكباتن | Admin | Not independently reviewed |
| 65 | مراجعة المستندات | Admin | Not independently reviewed |
| 66 | إدارة العربيات والفئات | Admin | Not independently reviewed |
| 67 | مراقبة الخطوط | Admin | Not independently reviewed |
| 68 | الحجوزات والاشتراكات | Admin | Not independently reviewed |
| 69 | المحافظ والتأمينات | Admin | Not independently reviewed |
| 70 | المعاملات المالية | Admin | Not independently reviewed |
| 71 | الشكاوى والدعم | Admin | Not independently reviewed |
| 72 | الإشعارات والإعلانات | Admin | Not independently reviewed |
| 73 | الإعدادات والصلاحيات | Admin | Not independently reviewed |

## First execution backlog

1. Capture and compare rider screens 8–21 in Arabic/English at 320/390px × Light/Dark, including offer, stop selection, automatic return reversal and no-offer/request states; visually preserve previously approved onboarding screens 1–7.
2. Audit global dynamic translation (including validation, amounts, calendar, time and accessible labels) and physical LTR direction; separate translation catalog presence from rendered completeness.
3. Audit captain 35–61 and admin 62–73 keyboard/focus, responsive tables, disabled/empty/error and recovery states.
4. Produce screenshot-based defect tickets with screen ID, locale, theme, viewport, reproduction, expected/actual, severity and evidence; fix in scoped commits, then re-run typecheck/lint/build/Playwright and inspect snapshots.
5. Treat all backend-dependent interactions as labelled preview. Never infer real OTP, payment, wallet, bookings or notifications from passing UI tests.

## Deployment rules

This branch is for isolated review work. **Do not merge to main, deploy Cloudflare production, write to Supabase, or enable real payments.** Require independent evidence and explicit owner approval before any release.
