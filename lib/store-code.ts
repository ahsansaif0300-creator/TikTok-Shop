import { getPrisma } from "@/lib/db";

export async function allocateStoreCode() {
  const prisma = getPrisma();
  const existing = await prisma.merchant.findMany({ select: { storeCode: true } });
  const used = new Set(existing.map((row) => row.storeCode));
  for (let index = 1; index < 10000; index += 1) {
    const code = `STORE${String(index).padStart(3, "0")}`;
    if (!used.has(code)) return code;
  }
  return `STORE${Date.now().toString(36).toUpperCase()}`;
}

export async function backfillStoreCodes() {
  const prisma = getPrisma();
  const merchants = await prisma.merchant.findMany({
    select: { id: true, storeCode: true },
    orderBy: { createdAt: "asc" },
  });
  const used = new Set(merchants.map((row) => row.storeCode).filter(Boolean));
  let next = 1;
  for (const merchant of merchants) {
    if (merchant.storeCode) continue;
    let code = `STORE${String(next).padStart(3, "0")}`;
    while (used.has(code)) {
      next += 1;
      code = `STORE${String(next).padStart(3, "0")}`;
    }
    await prisma.merchant.update({ where: { id: merchant.id }, data: { storeCode: code } });
    used.add(code);
    next += 1;
  }
}
