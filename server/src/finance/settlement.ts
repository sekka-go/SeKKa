export type PoolPackageType = "daily" | "weekly" | "monthly";

export type PoolSettlement = {
  listAmount: number;
  riderAmount: number;
  discountAmount: number;
  companyShareAmount: number;
  captainShareAmount: number;
  companyCommissionRate: number;
  settlementStatus: "pending";
};

const COMPANY_COMMISSION_RATE = 0.2;
const CAPTAIN_SHARE_RATE = 1 - COMPANY_COMMISSION_RATE;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function discountRate(packageType: PoolPackageType) {
  return packageType === "weekly" ? 0.05 : packageType === "monthly" ? 0.1 : 0;
}

/** Calculates the deferred split without capturing or transferring money. */
export function calculatePoolSettlement(listAmount: number, packageType: PoolPackageType): PoolSettlement {
  const safeListAmount = roundMoney(Math.max(0, listAmount));
  const riderAmount = roundMoney(safeListAmount * (1 - discountRate(packageType)));
  const discountAmount = roundMoney(safeListAmount - riderAmount);
  const captainShareAmount = roundMoney(safeListAmount * CAPTAIN_SHARE_RATE);
  const companyShareAmount = roundMoney(Math.max(0, safeListAmount * COMPANY_COMMISSION_RATE - discountAmount));

  return {
    listAmount: safeListAmount,
    riderAmount,
    discountAmount,
    companyShareAmount,
    captainShareAmount,
    companyCommissionRate: COMPANY_COMMISSION_RATE,
    settlementStatus: "pending",
  };
}
