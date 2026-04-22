import { serve } from "@hono/node-server";
import { buildApp } from "./buildApp.js";
import { getEnv } from "./env.js";

const app = buildApp();
const env = getEnv();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API server running at http://localhost:${info.port}`);
});
