import type { Category } from "../api";
import { getLanguage, t } from "../i18n/runtime";

export function money(value: number | null | undefined) {
  if (typeof value !== "number") return t("يظهر بعد اكتمال المجموعة");
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-EG";
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  return getLanguage() === "ar" ? `${amount} ${t("ج.م")}` : `${amount} EGP`;
}

export function categoryName(category?: Category | null) {
  if (!category) return t("فئة المشوار");
  return `${t(category.speed_tier === "faster" ? "أسرع" : "أوفر")} · ${t(category.has_ac ? "مكيّف" : "بدون تكييف")}`;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    waiting: "بانتظار ركاب", minimum_met: "اكتمل الحد الأدنى", active: "نشطة", price_review: "موافقة على السعر",
    needs_captain: "بانتظار كابتن", cancelled: "ملغاة", completed: "مكتملة", scheduled: "مجدولة",
    assigned: "أُسندت إليك", in_progress: "جارية", needs_captain_profile: "أكمل بياناتك",
    pending: "قيد المراجعة", approved: "موثّق", rejected: "مرفوض",
  };
  return labels[status] ? t(labels[status]!) : t(status.replaceAll("_", " "));
}

export function roleLabel(role: string) {
  const labels: Record<string, string> = { rider: "راكب", captain: "كابتن", admin: "مدير النظام" };
  return labels[role] ? t(labels[role]!) : t("مستخدم");
}

export function vehicleTypeLabel(type: string) {
  const labels: Record<string, string> = { private_car: "سيارة ملاكي", hiace: "هاي إس" };
  return labels[type] ? t(labels[type]!) : t("نوع مركبة غير معروف");
}

export function maskLastFour(value: string | null | undefined) {
  if (!value) return t("غير متاح");
  const digits = value.replace(/\s/g, "");
  return digits.length <= 4 ? `••••${digits}` : `••••${digits.slice(-4)}`;
}

export function formatDate(value: string) {
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-EG";
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

export function errorText(error: unknown) {
  return t(error instanceof Error ? error.message : "حصل خطأ غير متوقع.");
}
