import { handle } from "hono/vercel";
import { buildApp } from "../src/buildApp.js";

export const config = {
  runtime: "nodejs",
};

/**
 * Lazy build so a misconfigured environment surfaces as a readable
 * 503 response on the first request instead of crashing module load
 * and bubbling up as Vercel's opaque `FUNCTION_INVOCATION_FAILED`.
 *
 * The result (success or failure) is cached for the lifetime of the
 * runtime instance — env vars are baked in at boot, so retrying on
 * every request would just repeat the same throw.
 */
type Handler = (req: Request) => Response | Promise<Response>;

let cachedHandler: Handler | null = null;
let cachedError: Error | null = null;

function build(): void {
  if (cachedHandler || cachedError) return;
  try {
    const app = buildApp();
    cachedHandler = handle(app) satisfies Handler;
  } catch (err) {
    cachedError = err instanceof Error ? err : new Error(String(err));
  }
}

function unavailable(error: Error): Response {
  const body = {
    error: "service_unavailable",
    message: "API failed to initialize. Check server environment configuration.",
    detail: error.message,
  };
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

async function dispatch(req: Request): Promise<Response> {
  build();
  if (cachedHandler) {
    return cachedHandler(req);
  }
  if (cachedError) {
    return unavailable(cachedError);
  }
  return unavailable(new Error("API initialization produced no handler"));
}

export default dispatch;
export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
export const PATCH = dispatch;
export const OPTIONS = dispatch;
