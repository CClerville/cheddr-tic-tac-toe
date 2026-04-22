import { handle } from "hono/vercel";
import { buildApp } from "../src/buildApp";

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
type Built =
  | { ok: true; handler: (req: Request) => Response | Promise<Response> }
  | { ok: false; error: Error };

let cached: Built | null = null;

function build(): Built {
  if (cached) return cached;
  try {
    const app = buildApp();
    cached = { ok: true, handler: handle(app) };
  } catch (err) {
    cached = { ok: false, error: err as Error };
  }
  return cached;
}

async function dispatch(req: Request): Promise<Response> {
  const built = build();
  if (!built.ok) {
    const body = {
      error: "service_unavailable",
      message: "API failed to initialize. Check server environment configuration.",
      detail: built.error.message,
    };
    return new Response(JSON.stringify(body), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  return built.handler(req);
}

export default dispatch;
export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
export const PATCH = dispatch;
export const OPTIONS = dispatch;
