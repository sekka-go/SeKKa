import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePoolSettlement } from "../src/finance/settlement.js";

describe("Commute Pool deferred settlement", () => {
  it("keeps the full list split at 20/80 for a daily ride", () => {
    const result = calculatePoolSettlement(100, "daily");
    assert.deepEqual(result, {
      listAmount: 100,
      riderAmount: 100,
      discountAmount: 0,
      companyShareAmount: 20,
      captainShareAmount: 80,
      companyCommissionRate: 0.2,
      settlementStatus: "pending",
    });
  });

  it("absorbs the weekly discount from the company share", () => {
    const result = calculatePoolSettlement(100, "weekly");
    assert.equal(result.riderAmount, 95);
    assert.equal(result.discountAmount, 5);
    assert.equal(result.companyShareAmount, 15);
    assert.equal(result.captainShareAmount, 80);
    assert.equal(result.companyShareAmount + result.captainShareAmount, result.riderAmount);
  });

  it("absorbs the monthly discount while the captain keeps 80%", () => {
    const result = calculatePoolSettlement(100, "monthly");
    assert.equal(result.riderAmount, 90);
    assert.equal(result.discountAmount, 10);
    assert.equal(result.companyShareAmount, 10);
    assert.equal(result.captainShareAmount, 80);
  });
});
