export type CaptainEscrowReserve = {
  dailyCaptainShareAmount: number;
  reserveDays: number;
  reservedAmount: number;
};

export type CaptainEscrowTransfer = {
  amountDue: number;
  escrowFundedAmount: number;
  unfundedAmount: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** يحسب احتياطيًا تقديريًا من حصة الكابتن، من غير تنفيذ حجز مالي. */
export function calculateCaptainEscrowReserve(dailyListAmount: number, serviceDays: number): CaptainEscrowReserve {
  const dailyCaptainShareAmount = roundMoney(Math.max(0, dailyListAmount) * 0.8);
  const reserveDays = Math.min(4, Math.max(0, Math.floor(serviceDays)));
  return {
    dailyCaptainShareAmount,
    reserveDays,
    reservedAmount: roundMoney(dailyCaptainShareAmount * reserveDays),
  };
}

/** يوضح ما يغطيه الاحتياطي وما يظل مستحقًا خارج الاحتياطي. */
export function calculateCaptainEscrowTransfer(amountDue: number, availableAmount: number): CaptainEscrowTransfer {
  const safeDue = roundMoney(Math.max(0, amountDue));
  const escrowFundedAmount = roundMoney(Math.min(safeDue, Math.max(0, availableAmount)));
  return {
    amountDue: safeDue,
    escrowFundedAmount,
    unfundedAmount: roundMoney(safeDue - escrowFundedAmount),
  };
}
