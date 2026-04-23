import { serve } from "@hono/node-server";
import { buildApp } from "./buildApp.js";
import { getEnv } from "./env.js";
import { logger } from "./lib/logger.js";

const app = buildApp();
const env = getEnv();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("api.listen", { port: info.port });
});
