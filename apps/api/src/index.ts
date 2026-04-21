import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT) || 3005;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running at http://localhost:${info.port}`);
});
