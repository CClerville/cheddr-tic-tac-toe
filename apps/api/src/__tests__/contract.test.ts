import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp } from "../app.js";

const HealthSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  requestId: z.string(),
});

describe("API contract smoke", () => {
  it("GET /health matches expected wire shape", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(() => HealthSchema.parse(json)).not.toThrow();
  });
});
