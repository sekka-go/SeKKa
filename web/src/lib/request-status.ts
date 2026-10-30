/** Arabic labels for request states returned by the deployed SeKKa API. */
const requestStatusLabels: Record<string, string> = {
  open: "مفتوح",
  matched: "تم العثور على مسار",
  cancelled: "ملغي",
};

export function requestStatusLabel(value?: string | null): string {
  if (!value) return "الحالة غير متاحة من الخادم";
  return requestStatusLabels[value] ?? `حالة الطلب: ${value}`;
}
