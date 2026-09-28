import { PrismaClient } from "@prisma/client";
import { restoreOpsUsers } from "../lib/ops-users-store";
import { restoreStores } from "../lib/stores-persist";
import { pullRemotePersist } from "../lib/remote-persist";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  try {
    await pullRemotePersist();
  } catch (error) {
    console.warn("[harbor] remote persist pull skipped", error);
  }
  const users = await restoreOpsUsers(prisma);
  const stores = await restoreStores(prisma);
  const names = await prisma.merchant.findMany({
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });
  console.log(
    JSON.stringify({
      ok: true,
      restoredUsers: users,
      restoredStores: stores,
      merchants: names.map((row) => row.name),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
