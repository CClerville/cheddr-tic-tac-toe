import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("../lib/clerkVerify.js", () => ({
  verifyClerkSessionToken: vi.fn(),
}));

import { verifyClerkSessionToken } from "../lib/clerkVerify.js";
import { createApp } from "../app.js";
import { createUserRoutes } from "../routes/user.js";
import { createHarness } from "./harness.js";

afterEach(() => {
  vi.mocked(verifyClerkSessionToken).mockReset();
});

async function build() {
  const harness = await createHarness({ clerkSecretKey: "sk_test_fake_for_tests" });
  const app = createApp().route("/user", createUserRoutes(harness.deps));
  return { harness, app };
}

describe("PATCH /user/me", () => {
  it("returns 403 for anon callers", async () => {
    const { harness, app } = await build();
    const { token } = await harness.signInAnon();
    const res = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "new_name" }),
    });
    expect(res.status).toBe(403);
  });

  it("updates profile for Clerk callers", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInClerk("user_patch_ok_1");
    vi.mocked(verifyClerkSessionToken).mockResolvedValue({
      sub: userId,
    } as Awaited<ReturnType<typeof verifyClerkSessionToken>>);

    const res = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "patched_user",
        displayName: " Patched ",
        avatarColor: "#aabbcc",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: { username: string; displayName: string; avatarColor: string };
    };
    expect(body.profile.username).toBe("patched_user");
    expect(body.profile.displayName).toBe("Patched");
    expect(body.profile.avatarColor).toBe("#aabbcc");
  });

  it("returns 409 on username unique violation", async () => {
    const { harness, app } = await build();
    const { token: aTok, userId: aId } = await harness.signInClerk(
      "user_patch_conflict_a",
    );
    const { token: bTok, userId: bId } = await harness.signInClerk(
      "user_patch_conflict_b",
    );
    vi.mocked(verifyClerkSessionToken).mockImplementation(async (t) => {
      if (t === aTok) return { sub: aId } as Awaited<ReturnType<typeof verifyClerkSessionToken>>;
      if (t === bTok) return { sub: bId } as Awaited<ReturnType<typeof verifyClerkSessionToken>>;
      throw new Error("unexpected token");
    });

    const r1 = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${aTok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "shared_name" }),
    });
    expect(r1.status).toBe(200);

    const r2 = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bTok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "shared_name" }),
    });
    expect(r2.status).toBe(409);
  });

  it("returns 400 for invalid username regex", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInClerk("user_patch_badname");
    vi.mocked(verifyClerkSessionToken).mockResolvedValue({
      sub: userId,
    } as Awaited<ReturnType<typeof verifyClerkSessionToken>>);

    const res = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "no spaces" }),
    });
    expect(res.status).toBe(400);
  });

  it("allows null to clear displayName and avatarColor", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInClerk("user_patch_clear");
    vi.mocked(verifyClerkSessionToken).mockResolvedValue({
      sub: userId,
    } as Awaited<ReturnType<typeof verifyClerkSessionToken>>);

    await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "cleartest",
        displayName: "Hi",
        avatarColor: "#112233",
      }),
    });

    const res = await app.request("/user/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: null, avatarColor: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: { displayName: string | null; avatarColor: string | null };
    };
    expect(body.profile.displayName).toBeNull();
    expect(body.profile.avatarColor).toBeNull();
  });
});
