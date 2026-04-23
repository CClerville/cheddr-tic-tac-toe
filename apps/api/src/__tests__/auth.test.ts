import { Buffer } from "node:buffer";

import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("../lib/clerkVerify.js", () => ({
  verifyClerkSessionToken: vi.fn(),
}));
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { createApp } from "../app.js";
import { createAuthRoutes } from "../routes/auth.js";
import { mintAnonToken, verifyAnonToken } from "../lib/anonToken.js";
import { verifyClerkSessionToken } from "../lib/clerkVerify.js";
import { createHarness, type CreateHarnessOptions } from "./harness.js";

async function build(harnessOptions?: CreateHarnessOptions) {
  const harness = await createHarness(harnessOptions);
  const app = createApp().route("/auth", createAuthRoutes(harness.deps));
  return { harness, app };
}

/** JWT with RS256 + kid so auth attempts Clerk (signature is bogus). */
function fakeRs256SessionJwt(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "ins_testkeyid123456789" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "user_123" })).toString("base64url");
  return `${header}.${payload}.invalid-signature`;
}

describe("anon token mint/verify", () => {
  const secret = "test-jwt-secret-please-do-not-use-in-prod-32+";

  it("round-trips a freshly minted token", async () => {
    const { token, expiresAt } = await mintAnonToken(secret, "anon_abc");
    const payload = await verifyAnonToken(secret, token);
    expect(payload.sub).toBe("anon_abc");
    expect(payload.exp).toBe(expiresAt);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a token signed with a different secret", async () => {
    const { token } = await mintAnonToken(secret, "anon_abc");
    await expect(verifyAnonToken("a-different-secret-32-chars-long-1", token)).rejects.toThrow();
  });

  it("rejects subjects that don't carry the anon_ prefix", async () => {
    const bad = await mintAnonToken(secret, "user_clerk_id_pretending");
    await expect(verifyAnonToken(secret, bad.token)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { token } = await mintAnonToken(secret, "anon_abc", -10);
    await expect(verifyAnonToken(secret, token)).rejects.toThrow();
  });
});

describe("POST /auth/anon", () => {
  it("mints a usable token and creates a users row with kind=anon", async () => {
    const { harness, app } = await build();
    const res = await app.request("/auth/anon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "device-1234" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token: string;
      userId: string;
      expiresAt: number;
    };
    expect(body.userId).toMatch(/^anon_/);
    expect(body.token.split(".")).toHaveLength(3);
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, body.userId));
    expect(user?.kind).toBe("anon");
    expect(user?.elo).toBe(1000);
  });

  it("rejects requests with no deviceId", async () => {
    const { app } = await build();
    const res = await app.request("/auth/anon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /auth/me", () => {
  it("returns the resolved identity for a valid anon token", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInAnon();

    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      identity: { kind: string; id: string; elo: number };
    };
    expect(body.identity.kind).toBe("anon");
    expect(body.identity.id).toBe(userId);
    expect(body.identity.elo).toBe(1000);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const { app } = await build();
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a bogus token", async () => {
    const { app } = await build();
    const res = await app.request("/auth/me", {
      headers: { Authorization: "Bearer not.a.jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token signed with the wrong secret", async () => {
    const { app } = await build();
    const { token } = await mintAnonToken(
      "different-secret-32-chars-long-1234",
      "anon_x",
    );
    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });
});

describe("auth bearer routing with Clerk key configured", () => {
  afterEach(() => {
    vi.mocked(verifyClerkSessionToken).mockReset();
  });

  it("does not call Clerk verify for HS256 anon tokens", async () => {
    const { harness, app } = await build({
      clerkSecretKey: "sk_test_dummy_clerk_secret_key_placeholder",
    });
    const { token, userId } = await harness.signInAnon();

    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(verifyClerkSessionToken)).not.toHaveBeenCalled();
    const body = (await res.json()) as {
      identity: { kind: string; id: string; elo: number };
    };
    expect(body.identity.kind).toBe("anon");
    expect(body.identity.id).toBe(userId);
  });

  it("returns 401 when RS256 token fails Clerk and anon verify", async () => {
    vi.mocked(verifyClerkSessionToken).mockRejectedValue(new Error("JWT invalid"));
    const { app } = await build({ clerkSecretKey: "sk_test_dummy_clerk_secret_key_placeholder" });
    const token = fakeRs256SessionJwt();

    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(vi.mocked(verifyClerkSessionToken)).toHaveBeenCalledTimes(1);
  });

  it("accepts identity from Clerk when Clerk verify succeeds", async () => {
    vi.mocked(verifyClerkSessionToken).mockResolvedValue({
      sub: "user_vitest_clerk_auth",
    } as Awaited<ReturnType<typeof verifyClerkSessionToken>>);

    const { app } = await build({ clerkSecretKey: "sk_test_dummy_clerk_secret_key_placeholder" });
    const token = fakeRs256SessionJwt();

    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      identity: { kind: string; id: string };
    };
    expect(body.identity.kind).toBe("clerk");
    expect(body.identity.id).toBe("user_vitest_clerk_auth");
    expect(vi.mocked(verifyClerkSessionToken)).toHaveBeenCalledTimes(1);
  });
});
