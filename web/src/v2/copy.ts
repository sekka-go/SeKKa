export const copy = {
  brand: "سِكّة",
  tagline: "معاك في السِكّة",
  browse: "دوّر على خط",
  empty: "لسه مفيش خط مناسب.",
  retry: "جرّب تاني",
  loading: "بنجهّز بياناتك…",
  save: "احفظ البيانات",
  security:
    "تأمين الحجز 100 جنيه، منفصل عن سعر الاشتراك. مش رسوم خدمة، ومش خصم من اللي هتدفعه للكابتن.",
  pay: "ادفع للكابتن أول يوم.",
  moneyDisabled:
    "الشحن والسحب والحجز المالي لسه مش متاحين. هنفتحهم بعد تجهيز خدمة الدفع واعتماد الشروط.",
  renewalDisabled:
    "التجديد لسه مش متاح لحد اعتماد قواعد الأولوية. تقدر تتواصل مع الدعم.",
  success: "بياناتك اتسجلت.",
  profileRequired: "كمّل بياناتك الأول.",
  noData: "لسه مفيش بيانات هنا.",
  serviceUnavailable: "الخدمة مش جاهزة دلوقتي. جرّب تاني بعد شوية.",
};
const errors: Record<string, string> = {
  LEGAL_TERMS_UNAPPROVED: "التسجيل هيتاح بعد اعتماد شروط الاستخدام.",
  AUTH_REQUIRED: "سجّل دخولك الأول.",
  PROFILE_REQUIRED: copy.profileRequired,
  FORBIDDEN: "الصفحة دي مش متاحة لحسابك.",
  REAL_MONEY_DISABLED: copy.moneyDisabled,
  POLICY_OR_PROVIDER_APPROVAL_REQUIRED: copy.moneyDisabled,
  HOLIDAY_CALENDAR_UNAPPROVED:
    "بنراجع أيام التشغيل والإجازات. السعر النهائي هيتاح بعد المراجعة.",
  SOLD_OUT: "المقاعد اكتملت. تقدر تدخل قائمة الانتظار.",
  INSUFFICIENT_SECURITY: "رصيد تأمينك المتاح أقل من 100 جنيه.",
  QUOTE_CHANGED: "تفاصيل الاشتراك اتغيرت. راجع السعر والتواريخ تاني.",
  ROUTE_UNAVAILABLE: "الخط ده مش متاح دلوقتي.",
  CAPTAIN_NOT_APPROVED: "مستنيين اعتماد حسابك يا كابتن.",
  VEHICLE_NOT_APPROVED: "مستنيين اعتماد العربية.",
  PAYMENT_TOO_EARLY: "أكد الدفع بعد ما تدفع للكابتن أول يوم.",
  RIDER_CONFIRMATION_REQUIRED: "مستنيين الراكب يأكد الدفع الأول.",
  APPROVED_DOCUMENTS_REQUIRED: "راجع المستندات المطلوبة واعتمدها الأول.",
  SCHEDULE_REVIEW_REQUIRED: "الخط الإضافي محتاج مراجعة المواعيد الأول.",
  BOOKING_NOT_CONFIRMABLE: "الحجز محتاج مراجعة من الدعم.",
  INVALID_PROFILE: "راجع اسمك ونوع حسابك والموافقات.",
  IDEMPOTENCY_CONFLICT: "الطلب ده مرتبط بحجز مختلف. راجع اشتراكاتك.",
  CYCLE_NOT_STARTED: "دورة الخط لسه مبدأتش. راجع المواعيد مع الكابتن.",
  INVALID_CAPACITY: "راجع عدد المقاعد المتاحة للفئة.",
};
export function errorCopy(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "INVALID_EGYPTIAN_PHONE") return "اكتب رقم موبايل مصري صحيح.";
  for (const [code, text] of Object.entries(errors))
    if (message.includes(code)) return text;
  return "مقدرناش نكمّل الطلب. راجع البيانات والاتصال، وجرّب تاني.";
}
