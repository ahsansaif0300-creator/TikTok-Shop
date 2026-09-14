export const STORE_CATEGORIES = [
  "Hot Selling Items",
  "Computer accessories",
  "Home cabinets",
  "Health Products",
  "Men's clothing",
  "Women's clothing",
  "Snacks and desserts",
  "Mobile accessories",
  "Children's toys",
  "Beverages",
  "Office supplies",
  "Digital products",
  "Beauty and skincare",
  "Mother and baby products",
  "Jewelry and watches",
  "Luxury goods",
  "Children's clothing",
  "Men's bags",
  "Women's bags",
  "Fitness Equipment",
] as const;

export function categorySlug(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function sortStoreCategories<T extends { name: string }>(categories: T[]) {
  return [...categories].sort((a, b) => {
    const left = STORE_CATEGORIES.indexOf(a.name as (typeof STORE_CATEGORIES)[number]);
    const right = STORE_CATEGORIES.indexOf(b.name as (typeof STORE_CATEGORIES)[number]);
    const leftRank = left === -1 ? STORE_CATEGORIES.length : left;
    const rightRank = right === -1 ? STORE_CATEGORIES.length : right;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return a.name.localeCompare(b.name);
  });
}
