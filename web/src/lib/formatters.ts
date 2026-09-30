import type { Category } from "../api";

export function money(value: number | null | undefined) {
  return typeof value === "number"
    ? `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ج.م`
    : "يظهر بعد اكتمال المجموعة";
}

export function categoryName(category?: Category | null) {
  if (!category) return "فئة المشوار";
  return `${category.speed_tier === "faster" ? "Faster" : "Saver"} · ${category.has_ac ? "مكيّف" : "بدون تكييف"}`;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    waiting: "بانتظار ركاب", minimum_met: "اكتمل الحد الأدنى", active: "نشطة", price_review: "موافقة على السعر",
    needs_captain: "بانتظار كابتن", cancelled: "ملغاة", completed: "مكتملة", scheduled: "مجدولة",
    assigned: "أُسندت إليك", in_progress: "جارية", needs_captain_profile: "أكمل بياناتك",
    pending: "قيد المراجعة", approved: "موثّق", rejected: "مرفوض",
  };
  return labels[status] ?? status;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "حصل خطأ غير متوقع.";
}
