import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function allocateReferralCode() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = `REF${randomBytes(3).toString("hex").toUpperCase()}`;
    const hit = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!hit) return code;
  }
  throw new Error("Could not allocate a referral code");
}

export async function findOpsByReferralCode(raw: string) {
  const referralCode = normalizeReferralCode(raw);
  if (!referralCode) return null;
  return prisma.user.findFirst({
    where: { referralCode, role: "OPS" },
    select: { id: true, name: true, username: true, email: true, referralCode: true },
  });
}

export async function ensureOpsReferralCodes() {
  const ops = await prisma.user.findMany({
    where: { role: "OPS", OR: [{ referralCode: null }, { referralCode: "" }] },
    select: { id: true },
  });
  for (const user of ops) {
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: await allocateReferralCode() },
    });
  }
}
