import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureDatabase } = await import("./lib/ensure-db");
  try {
    await ensureDatabase();
    const { startReleaseScheduler } = await import("./lib/process-releases");
    startReleaseScheduler();
  } catch (error) {
    console.error("[harbor] Could not prepare the database on boot.", error);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error("[harbor] server error", {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
    message: error instanceof Error ? error.message : String(error),
  });
};
