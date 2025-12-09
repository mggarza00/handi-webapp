const IVA_RATE = 0.16;

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeClientFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const base = amount * 0.05; // 5%
  const fee = Math.min(1500, Math.max(50, base));
  return roundCurrency(fee);
}

export function computeClientTotals(amount: number, ivaRate = IVA_RATE) {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const fee = computeClientFee(safeAmount);
  const iva = roundCurrency((safeAmount + fee) * ivaRate);
  const total = roundCurrency(safeAmount + fee + iva);
  return { amount: safeAmount, fee, iva, total, ivaRate };
}

export function computeClientTotalsCents(amount: number, ivaRate = IVA_RATE) {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const baseCents = Math.round(safeAmount * 100);
  const feeCents =
    baseCents > 0
      ? Math.min(150000, Math.max(5000, Math.round(baseCents * 0.05)))
      : 0;
  const ivaCents = Math.round((baseCents + feeCents) * ivaRate);
  const totalCents = baseCents + feeCents + ivaCents;
  return { baseCents, feeCents, ivaCents, totalCents, ivaRate };
}

export const CLIENT_IVA_RATE = IVA_RATE;
