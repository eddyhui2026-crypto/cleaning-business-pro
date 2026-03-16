/** UK standard VAT rate (fixed). */
export const UK_VAT_RATE = 0.2; // 20%

export function addVatToAmount(amountExVat: number): number {
  return Math.round(amountExVat * (1 + UK_VAT_RATE) * 100) / 100;
}

export function subtotalFromTotalIncludingVat(totalInclVat: number): number {
  return Math.round((totalInclVat / (1 + UK_VAT_RATE)) * 100) / 100;
}

export function vatAmountFromTotalIncludingVat(totalInclVat: number): number {
  return Math.round((totalInclVat - totalInclVat / (1 + UK_VAT_RATE)) * 100) / 100;
}
