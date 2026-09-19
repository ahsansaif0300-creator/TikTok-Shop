import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

export const LLC_CODE_DIGITS = 8;

export function normalizeReferralCode(value: string) {
  return value.trim().replace(/[\s-]+/g, "");
}

export function isNumericLlcCode(value: string) {
  return new RegExp(`^\\d{${LLC_CODE_DIGITS}}$`).test(value);
}

export async function allocateReferralCode() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = String(randomInt(10 ** (LLC_CODE_DIGITS - 1), 10 ** LLC_CODE_DIGITS));
    const hit = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!hit) return code;
  }
  throw new Error("Could not allocate an LLC code");
}

export async function findOpsByReferralCode(raw: string) {
  const referralCode = normalizeReferralCode(raw);
  if (!isNumericLlcCode(referralCode)) return null;
  return prisma.user.findFirst({
    where: { referralCode, role: "OPS" },
    select: { id: true, name: true, username: true, email: true, referralCode: true },
  });
}

export async function ensureOpsReferralCodes() {
  const ops = await prisma.user.findMany({
    where: { role: "OPS" },
    select: { id: true, referralCode: true },
  });
  for (const user of ops) {
    if (user.referralCode && isNumericLlcCode(user.referralCode)) continue;
    const next = await allocateReferralCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: next },
    });
    if (user.referralCode) {
      await prisma.merchant.updateMany({
        where: { referralCodeUsed: user.referralCode },
        data: { referralCodeUsed: next },
      });
      await prisma.merchantApplication.updateMany({
        where: { referralCode: user.referralCode },
        data: { referralCode: next },
      });
    }
  }
}
