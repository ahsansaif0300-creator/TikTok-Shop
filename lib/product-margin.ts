export const MARGIN_MIN = 0.23;
export const MARGIN_MAX = 0.25;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function costFromSelling(selling: number, margin: number) {
  const price = roundMoney(selling);
  const cents = Math.round(price * 100);
  let costCents = Math.round(cents * (1 - margin));
  const clamp = () => {
    const profit = cents - costCents;
    return profit / cents;
  };
  while (clamp() < MARGIN_MIN && costCents > 1) costCents -= 1;
  while (clamp() > MARGIN_MAX) costCents += 1;
  const cost = costCents / 100;
  const profit = roundMoney(price - cost);
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  return { price, cost, profit, marginPct };
}

export function productEconomics(price: number, cost: number) {
  const profit = roundMoney(price - cost);
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  return { profit, marginPct };
}

export function isMarginInRange(price: number, cost: number) {
  if (price <= 0) return false;
  const margin = (price - cost) / price;
  return margin >= MARGIN_MIN - 0.0005 && margin <= MARGIN_MAX + 0.0005;
}

export function catalogArtPath(sku: string) {
  return `/product-art/${encodeURIComponent(sku)}`;
}
