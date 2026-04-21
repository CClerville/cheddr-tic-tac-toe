import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("createApp / health", () => {
  it("responds 200 OK with status payload", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; requestId: string };
    expect(json.status).toBe("ok");
    expect(json.requestId).toMatch(/[a-f0-9-]{36}/);
  });

  it("echoes inbound x-request-id back via response header", async () => {
    const app = createApp();
    const res = await app.request("/health", {
      headers: { "x-request-id": "abc-123" },
    });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
  });

  it("ignores oversized inbound x-request-id and generates a new one", async () => {
    const app = createApp();
    const res = await app.request("/health", {
      headers: { "x-request-id": "x".repeat(200) },
    });
    expect(res.headers.get("x-request-id")).not.toBe("x".repeat(200));
  });
});
