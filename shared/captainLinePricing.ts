export const CAPTAIN_LINE_PAYMENT_METHODS = ["cash", "instapay", "wallet"] as const;
export type CaptainLinePaymentMethod = typeof CAPTAIN_LINE_PAYMENT_METHODS[number];

export const MIN_CAPTAIN_LINE_PRICE = 0.01;
export const MAX_CAPTAIN_LINE_PRICE = 99_999_999.99;

export type CaptainLinePricingValidation =
  | { ok: true; pricePerSeat: number; paymentMethods: CaptainLinePaymentMethod[] }
  | { ok: false; reason: "price_required" | "price_invalid" | "payment_method_required" | "payment_method_unsupported" };

/** Shared frontend/backend validation so captain offers obey one contract. */
export function validateCaptainLinePricing(priceValue: unknown, methodsValue: unknown): CaptainLinePricingValidation {
  if (priceValue == null || (typeof priceValue === "string" && priceValue.trim() === "")) {
    return { ok: false, reason: "price_required" };
  }
  if (typeof priceValue !== "number" && typeof priceValue !== "string") {
    return { ok: false, reason: "price_invalid" };
  }

  const pricePerSeat = typeof priceValue === "number" ? priceValue : Number(priceValue);
  if (!Number.isFinite(pricePerSeat) || pricePerSeat < MIN_CAPTAIN_LINE_PRICE || pricePerSeat > MAX_CAPTAIN_LINE_PRICE) {
    return { ok: false, reason: "price_invalid" };
  }

  if (!Array.isArray(methodsValue) || methodsValue.length === 0) {
    return { ok: false, reason: "payment_method_required" };
  }

  const paymentMethods = [...new Set(methodsValue.map(String))];
  if (paymentMethods.some((method) => !CAPTAIN_LINE_PAYMENT_METHODS.includes(method as CaptainLinePaymentMethod))) {
    return { ok: false, reason: "payment_method_unsupported" };
  }

  return { ok: true, pricePerSeat, paymentMethods: paymentMethods as CaptainLinePaymentMethod[] };
}

export function isCaptainLinePaymentMethod(value: string): value is CaptainLinePaymentMethod {
  return CAPTAIN_LINE_PAYMENT_METHODS.includes(value as CaptainLinePaymentMethod);
}

export function captainLinePricingError(reason: Extract<CaptainLinePricingValidation, { ok: false }>['reason']): string {
  switch (reason) {
    case "price_required": return "أدخل سعر المقعد قبل نشر العرض.";
    case "price_invalid": return "أدخل سعرًا للمقعد بين 0.01 و99,999,999.99 جنيه.";
    case "payment_method_required": return "اختر وسيلة دفع مباشر واحدة على الأقل.";
    case "payment_method_unsupported": return "وسائل الدفع المتاحة هي النقد والمحفظة الإلكترونية الخارجية وInstaPay.";
  }
}
