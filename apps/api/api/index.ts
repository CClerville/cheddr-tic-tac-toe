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
type BuildOk = { ok: true; handler: Handler };
type BuildErr = { ok: false; error: Error };
type Built = BuildOk | BuildErr;

let cached: Built | null = null;

function build(): Built {
  if (cached) return cached;
  try {
    const app = buildApp();
    cached = { ok: true, handler: handle(app) satisfies Handler };
  } catch (err) {
    cached = {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
  return cached;
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
  const built = build();
  if (built.ok) return built.handler(req);
  return unavailable(built.error);
}

export default dispatch;
export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
export const PATCH = dispatch;
export const OPTIONS = dispatch;
