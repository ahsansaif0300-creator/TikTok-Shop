import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { resolveSupportUpload } from "@/lib/support-media";

export async function GET(_request: Request, context: { params: Promise<{ messageId: string }> }) {
  const session = await requireSession();
  const { messageId } = await context.params;
  const message = await prisma.supportMessage.findUnique({
    where: { id: messageId },
    include: { thread: true },
  });
  if (!message?.attachmentPath) {
    return new Response("Not found", { status: 404 });
  }
  const owner = session.role === "MERCHANT" && session.merchantId === message.thread.merchantId;
  if (!owner && !isStaff(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const dest = resolveSupportUpload(message.attachmentPath);
  if (!dest || !existsSync(dest)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = await readFile(dest);
  return new Response(buf, {
    headers: {
      "Content-Type": message.attachmentMime || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
