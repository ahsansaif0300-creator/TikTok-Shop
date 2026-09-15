export const STORE_RATING_MIN = 0;
export const STORE_RATING_MAX = 10;
export const STORE_CREDIT_MIN = 0;
export const STORE_CREDIT_MAX = 100;
export const DEFAULT_STORE_RATING = 5.5;
export const DEFAULT_STORE_CREDIT = 100;

function parseNumber(raw: unknown) {
  if (typeof raw === "number") return raw;
  const text = String(raw ?? "").trim();
  if (!text) return NaN;
  return Number(text);
}

export function parseStoreRating(raw: unknown) {
  const value = parseNumber(raw);
  if (!Number.isFinite(value) || value < STORE_RATING_MIN || value > STORE_RATING_MAX) {
    return null;
  }
  return Number(value.toFixed(1));
}

export function parseStoreCreditScore(raw: unknown) {
  const value = parseNumber(raw);
  if (!Number.isFinite(value) || value < STORE_CREDIT_MIN || value > STORE_CREDIT_MAX) {
    return null;
  }
  const integer = Math.round(value);
  if (Math.abs(value - integer) > 1e-9) return null;
  return integer;
}

export function formatStoreRating(value: number) {
  return Number(value).toFixed(1);
}
