import { prisma } from "@/lib/db";
import { expireStaleSupportSessions } from "@/lib/service-session";

const sessionInclude = {
  thread: {
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          storeCode: true,
          slug: true,
          email: true,
          phone: true,
          city: true,
          country: true,
          status: true,
        },
      },
    },
  },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1, include: { user: true } },
};

export async function loadSupportInbox(now = new Date()) {
  await expireStaleSupportSessions(now);
  const [active, history, stores] = await Promise.all([
    prisma.supportSession.findMany({
      where: { status: "ACTIVE", expiresAt: { gt: now } },
      include: sessionInclude,
      orderBy: { startedAt: "desc" },
    }),
    prisma.supportSession.findMany({
      where: { OR: [{ status: "EXPIRED" }, { expiresAt: { lte: now } }] },
      include: sessionInclude,
      orderBy: { expiresAt: "desc" },
      take: 60,
    }),
    prisma.merchant.findMany({
      where: { status: { in: ["ACTIVE", "PENDING"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, storeCode: true, slug: true },
    }),
  ]);
  return { active, history, stores, now };
}

export type SupportInboxRow = Awaited<ReturnType<typeof loadSupportInbox>>["active"][number];
