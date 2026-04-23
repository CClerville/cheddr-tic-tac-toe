import { zValidator } from "@hono/zod-validator";
import {
  AnalysisRequestSchema,
  CommentaryRequestSchema,
  HintRequestSchema,
} from "@cheddr/api-types";
import { Hono } from "hono";

import { resolveAiLimiters } from "../lib/ai/rateLimit.js";
import { generateAnalysis } from "../services/ai/analysis.js";
import { streamCommentary } from "../services/ai/commentary.js";
import { generateHint } from "../services/ai/hint.js";
import { auth } from "../middleware/auth.js";
import type { AppBindings, AppDeps } from "../types.js";

/**
 * Hono router for `/ai/*`. Each handler is intentionally a thin shim
 * around the matching service in `services/ai/` — keeping HTTP plumbing
 * (validation, auth, response shape) here and pure orchestration there
 * makes the services unit-testable without spinning up Hono.
 */
export function createAiRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret } = deps;
  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });
  const limiters = resolveAiLimiters(redis, deps.aiLimiters);

  return new Hono<AppBindings>()
    .use("*", requireAuth)

    .post(
      "/commentary",
      zValidator("json", CommentaryRequestSchema),
      async (c) => {
        return streamCommentary(
          { deps, redis, db, limiter: limiters.commentary },
          {
            identityId: c.get("identity").id,
            request: c.req.valid("json"),
            requestId: c.get("requestId"),
          },
        );
      },
    )

    .post("/hint", zValidator("json", HintRequestSchema), async (c) => {
      const body = await generateHint(
        { deps, redis, db, limiter: limiters.hint },
        {
          identityId: c.get("identity").id,
          request: c.req.valid("json"),
        },
      );
      return c.json(body);
    })

    .post("/analysis", zValidator("json", AnalysisRequestSchema), async (c) => {
      const body = await generateAnalysis(
        { deps, redis, db, limiter: limiters.analysis },
        {
          identityId: c.get("identity").id,
          request: c.req.valid("json"),
          requestId: c.get("requestId"),
        },
      );
      return c.json(body);
    });
}
