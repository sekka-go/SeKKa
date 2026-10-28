import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePoolSettlement } from "../src/finance/settlement.js";

describe("Commute Pool deferred settlement", () => {
  it("keeps the full fare with the captain and charges no commission for a daily ride", () => {
    const result = calculatePoolSettlement(100, "daily");
    assert.deepEqual(result, {
      listAmount: 100,
      riderAmount: 100,
      discountAmount: 0,
      companyShareAmount: 0,
      captainShareAmount: 100,
      companyCommissionRate: 0,
      settlementStatus: "pending",
    });
  });

  it("keeps the weekly discount and assigns the rider amount to the captain", () => {
    const result = calculatePoolSettlement(100, "weekly");
    assert.equal(result.riderAmount, 95);
    assert.equal(result.discountAmount, 5);
    assert.equal(result.companyShareAmount, 0);
    assert.equal(result.captainShareAmount, 95);
    assert.equal(result.companyShareAmount + result.captainShareAmount, result.riderAmount);
  });

  it("keeps the monthly discount and charges no commission", () => {
    const result = calculatePoolSettlement(100, "monthly");
    assert.equal(result.riderAmount, 90);
    assert.equal(result.discountAmount, 10);
    assert.equal(result.companyShareAmount, 0);
    assert.equal(result.captainShareAmount, 90);
  });
});
