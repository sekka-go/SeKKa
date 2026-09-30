import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCaptainEscrowReserve, calculateCaptainEscrowTransfer } from "../src/finance/captain-escrow.js";

describe("fixed captain deferred escrow", () => {
  it("reserves up to four service days from the captain's 80% share", () => {
    assert.deepEqual(calculateCaptainEscrowReserve(100, 22), {
      dailyCaptainShareAmount: 80,
      reserveDays: 4,
      reservedAmount: 320,
    });
  });

  it("does not reserve more days than the package contains", () => {
    assert.deepEqual(calculateCaptainEscrowReserve(75, 3), {
      dailyCaptainShareAmount: 60,
      reserveDays: 3,
      reservedAmount: 180,
    });
  });

  it("records any replacement amount that exceeds the remaining reserve", () => {
    assert.deepEqual(calculateCaptainEscrowTransfer(90, 65), {
      amountDue: 90,
      escrowFundedAmount: 65,
      unfundedAmount: 25,
    });
  });

  it("never records a negative reserve or payout", () => {
    assert.deepEqual(calculateCaptainEscrowReserve(-10, -4), {
      dailyCaptainShareAmount: 0,
      reserveDays: 0,
      reservedAmount: 0,
    });
    assert.deepEqual(calculateCaptainEscrowTransfer(-5, -3), {
      amountDue: 0,
      escrowFundedAmount: 0,
      unfundedAmount: 0,
    });
  });
});
