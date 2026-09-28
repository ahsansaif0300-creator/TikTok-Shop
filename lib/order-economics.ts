export function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

/** Store-facing profit is what the customer paid minus product cost. */
export function orderProfitAmount(total: number, cost: number) {
  return roundMoney(total - cost);
}
