import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useAuthBootstrap, AuthBootstrap } from "@/providers/AuthBootstrap";

const mockUseAuth = vi.fn();

vi.mock("@clerk/clerk-expo", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  ensureAnonIdentity: vi.fn().mockResolvedValue({ userId: "anon_test" }),
}));

vi.mock("@/lib/api", () => ({
  setClerkTokenGetter: vi.fn(),
}));

function Probe() {
  const { ready, identityKind } = useAuthBootstrap();
  return (
    <span data-testid="probe">
      {String(ready)}:{identityKind}
    </span>
  );
}

describe("AuthBootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not overwrite clerk with unknown when bootstrap finishes before timeout", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("jwt"),
      userId: "user_1",
    });

    render(
      <AuthBootstrap>
        <Probe />
      </AuthBootstrap>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe(
      "true:clerk",
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe(
      "true:clerk",
    );
  });
});
