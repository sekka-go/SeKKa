import {
  validateCaptainLinePricing,
  MIN_CAPTAIN_LINE_PRICE,
  MAX_CAPTAIN_LINE_PRICE,
} from "../../../shared/captainLinePricing.ts";

Deno.test("captain line price and direct payment methods share one accepted contract", () => {
  for (const paymentMethod of ["cash", "instapay", "wallet"]) {
    const result = validateCaptainLinePricing(125.5, [paymentMethod]);
    if (!result.ok || result.pricePerSeat !== 125.5 || result.paymentMethods[0] !== paymentMethod) {
      throw new Error(`Expected ${paymentMethod} and a valid price to pass.`);
    }
  }
});

Deno.test("captain line pricing rejects missing, non-finite, and out-of-range values", () => {
  for (const price of [null, undefined, "", 0, -1, Number.NaN, Number.POSITIVE_INFINITY, MAX_CAPTAIN_LINE_PRICE + 0.01]) {
    if (validateCaptainLinePricing(price, ["cash"]).ok) throw new Error(`Expected price ${String(price)} to fail.`);
  }
  if (!validateCaptainLinePricing(MIN_CAPTAIN_LINE_PRICE, ["cash"]).ok) throw new Error("Minimum price should be accepted.");
  if (!validateCaptainLinePricing(MAX_CAPTAIN_LINE_PRICE, ["cash"]).ok) throw new Error("Maximum price should be accepted.");
});

Deno.test("captain line pricing rejects empty and unknown payment methods", () => {
  for (const methods of [[], ["unknown"], ["cash", "bank"]]) {
    if (validateCaptainLinePricing(50, methods).ok) throw new Error(`Expected methods ${methods.join(",")} to fail.`);
  }
});

Deno.test("captain line pricing removes duplicate payment method values", () => {
  const result = validateCaptainLinePricing(50, ["cash", "cash", "wallet"]);
  if (!result.ok || result.paymentMethods.join(",") !== "cash,wallet") {
    throw new Error("Expected duplicate payment methods to be deduplicated.");
  }
});
