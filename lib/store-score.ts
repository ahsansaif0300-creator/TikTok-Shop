export const STORE_RATING_MIN = 0;
export const STORE_RATING_MAX = 5;
export const STORE_CREDIT_MIN = 0;
export const STORE_CREDIT_MAX = 100;
export const DEFAULT_STORE_RATING = 5.0;
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
  return clampStoreRating(value).toFixed(1);
}

export function clampStoreRating(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STORE_RATING;
  if (value > STORE_RATING_MAX) return DEFAULT_STORE_RATING;
  if (value < STORE_RATING_MIN) return STORE_RATING_MIN;
  return Number(value.toFixed(1));
}

export function formatStoreRatingOutOf(value: number) {
  return formatStoreRating(clampStoreRating(value));
}
