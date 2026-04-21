import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const app = new Hono()
  .use("*", cors())
  .use("*", logger())
  .get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

export type AppType = typeof app;
