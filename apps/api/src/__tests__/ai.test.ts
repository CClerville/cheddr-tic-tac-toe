import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";

import { createGame, getAiMove, makeMove } from "@cheddr/game-engine";

import { createApp } from "../app.js";
import { createMemoryAiLimiters } from "../lib/ai/rateLimit.js";
import { commentaryFallbackLine } from "../lib/ai/commentaryGuard.js";
import {
  deleteSession,
  getSession,
  saveCompletedSessionForAi,
  updateSession,
} from "../lib/session.js";
import type { GameSession } from "../lib/session.js";
import { createAiRoutes } from "../routes/ai.js";
import { createGameRoutes } from "../routes/game.js";
import { createHarness } from "./harness.js";

function textStreamFromParts(
  parts: LanguageModelV3StreamPart[],
): ReadableStream<LanguageModelV3StreamPart> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
}

async function buildTestApp(options?: {
  commentaryMax?: number;
  hintMax?: number;
  mockModel?: MockLanguageModelV3;
  commentaryMockModel?: MockLanguageModelV3;
}) {
  const harness = await createHarness();
  const deps = {
    ...harness.deps,
    aiLimiters: createMemoryAiLimiters({
      commentaryMax: options?.commentaryMax,
      hintMax: options?.hintMax,
    }),
    ...(options?.commentaryMockModel
      ? {
          commentaryLanguageModelOverride: () =>
            options.commentaryMockModel!,
        }
      : {}),
    ...(options?.mockModel
      ? { languageModelOverride: () => options.mockModel! }
      : {}),
  };
  const app = createApp()
    .route("/game", createGameRoutes(deps))
    .route("/ai", createAiRoutes(deps));
  return { harness, app, deps };
}

async function startSession(
  app: Awaited<ReturnType<typeof buildTestApp>>["app"],
  token: string,
  body: Record<string, unknown> = {},
) {
  const res = await app.request("/game/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ difficulty: "beginner", ranked: true, ...body }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { sessionId: string };
}

describe("AI routes", () => {
  // Suppress the [ai/...] warn lines our hardened handlers emit on
  // simulated provider failures. We re-assert no unhandled rejection
  // by tracking process events instead.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let unhandled: unknown[] = [];
  const onUnhandled = (err: unknown) => unhandled.push(err);

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.off("unhandledRejection", onUnhandled);
  });

  it("POST /ai/hint returns 429 when rate limited", async () => {
    const { harness, app } = await buildTestApp({ hintMax: 0 });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const res = await app.request("/ai/hint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });
    expect(res.status).toBe(429);
  });

  it("POST /ai/commentary returns 429 when rate limited", async () => {
    const { harness, app } = await buildTestApp({ commentaryMax: 0 });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "move" }),
    });
    expect(res.status).toBe(429);
  });

  it("POST /ai/hint falls back to engine when the model fails", async () => {
    const mock = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("simulated provider failure");
      },
    });
    const { harness, app } = await buildTestApp({ mockModel: mock });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const res = await app.request("/ai/hint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      position: number;
      fellBackToEngine: boolean;
      confidence: number;
    };
    expect(body.fellBackToEngine).toBe(true);
    expect(body.confidence).toBe(0);
    expect(body.position).toBeGreaterThanOrEqual(0);
    expect(body.position).toBeLessThanOrEqual(8);
  });

  it("POST /ai/analysis is idempotent when ai_analysis is already stored", async () => {
    const mock = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("should not be called");
      },
    });
    const { harness, app, deps } = await buildTestApp({ mockModel: mock });
    const { token, userId } = await harness.signInAnon();

    const cached = {
      summary: "Cached summary",
      turns: [
        { moveIndex: 1, severity: "good" as const, comment: "Solid open." },
      ],
    };

    const [inserted] = await deps.db
      .insert(schema.games)
      .values({
        userId,
        difficulty: "beginner",
        result: "win",
        moveHistory: [4],
        eloDelta: 0,
        ranked: true,
        aiAnalysis: cached,
      })
      .returning({ id: schema.games.id });

    const gameId = inserted!.id;

    const res1 = await app.request("/ai/analysis", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId }),
    });
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual(cached);
    expect(mock.doGenerateCalls.length).toBe(0);

    const res2 = await app.request("/ai/analysis", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId }),
    });
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual(cached);
    expect(mock.doGenerateCalls.length).toBe(0);
  });

  it("POST /ai/commentary returns 200 with empty body when the model stream fails", async () => {
    const mock = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error("simulated stream failure");
      },
    });
    const { harness, app } = await buildTestApp({ mockModel: mock });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "move" }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("");

    // Give any rejected microtasks a tick to surface before we assert.
    await new Promise((resolve) => setImmediate(resolve));
    expect(unhandled).toEqual([]);
  });

  it("POST /ai/analysis returns 503 ai_unavailable on provider failure without persisting", async () => {
    const mock = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("simulated provider failure");
      },
    });
    const { harness, app, deps } = await buildTestApp({ mockModel: mock });
    const { token, userId } = await harness.signInAnon();

    const [inserted] = await deps.db
      .insert(schema.games)
      .values({
        userId,
        difficulty: "beginner",
        result: "win",
        moveHistory: [4],
        eloDelta: 0,
        ranked: true,
      })
      .returning({ id: schema.games.id });
    const gameId = inserted!.id;

    const res = await app.request("/ai/analysis", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string; message?: string };
    expect(body.error).toBe("ai_unavailable");

    const [row] = await deps.db
      .select({ aiAnalysis: schema.games.aiAnalysis })
      .from(schema.games)
      .where(eq(schema.games.id, gameId))
      .limit(1);
    expect(row?.aiAnalysis).toBeNull();

    await new Promise((resolve) => setImmediate(resolve));
    expect(unhandled).toEqual([]);
  });

  it("POST /ai/hint passes player displayName into the model system prompt", async () => {
    const hintJson = JSON.stringify({
      position: 4,
      reasoning: "Take the center.",
      confidence: 0.9,
    });

    const mock = new MockLanguageModelV3({
      doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
        content: [{ type: "text", text: hintJson }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 1,
            text: 1,
            reasoning: undefined,
          },
        },
        warnings: [],
      }),
    });

    const { harness, app, deps } = await buildTestApp({ mockModel: mock });
    const { token, userId } = await harness.signInAnon();

    await deps.db
      .update(schema.users)
      .set({ displayName: "Sam" })
      .where(eq(schema.users.id, userId));

    const { sessionId } = await startSession(app, token);

    const res = await app.request("/ai/hint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });
    expect(res.status).toBe(200);

    expect(mock.doGenerateCalls.length).toBeGreaterThan(0);
    const firstCall = mock.doGenerateCalls[0];
    const promptBlob = JSON.stringify(firstCall);
    // Name appears in Cheddr's system prompt and in the legal-move hint line.
    expect(promptBlob).toContain("Sam");
    const systemChunks = firstCall.prompt.filter(
      (p) => p.role === "system",
    );
    expect(JSON.stringify(systemChunks)).toContain("Sam");
  });

  it("POST /ai/commentary persists fallback when streamed text fails spatial validation", async () => {
    const tid = "t_commentary_stream";
    const usage = {
      inputTokens: {
        total: 1,
        noCache: 1,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 8,
        text: 8,
        reasoning: undefined,
      },
    };
    const finishReason = { unified: "stop" as const, raw: undefined };
    const mock = new MockLanguageModelV3({
      doStream: async () => {
        const stream = textStreamFromParts([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: tid },
          {
            type: "text-delta",
            id: tid,
            delta: "Nice eye placing your X in the center",
          },
          { type: "text-end", id: tid },
          { type: "finish", usage, finishReason },
        ]);
        return { stream };
      },
    });

    const { harness, app, deps } = await buildTestApp({
      commentaryMockModel: mock,
    });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const session = await getSession(deps.redis, sessionId);
    expect(session).not.toBeNull();
    const board = [
      "O",
      null,
      null,
      null,
      null,
      "X",
      null,
      null,
      null,
    ] as const;
    await updateSession(deps.redis, {
      ...session!,
      board,
      moveHistory: [5, 0],
      currentPlayer: "X",
    });

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "move" }),
    });
    expect(res.status).toBe(200);
    const streamed = await res.text();
    expect(streamed).toContain("Nice eye placing your X in the center");

    const listKey = `session:commentary:list:${sessionId}`;
    const lines = await deps.redis.lrange<string>(listKey, 0, -1);
    expect(lines?.length).toBeGreaterThan(0);
    const last = JSON.parse(lines![lines!.length - 1]!) as { text: string };
    expect(last.text).toBe(
      commentaryFallbackLine([5, 0], { status: "in_progress" }),
    );
    expect(last.text).not.toContain("center");
  });

  it("POST /ai/commentary terminal includes post-game loss voice when snapshot is terminal", async () => {
    const tid = "t_terminal_loss";
    const usage = {
      inputTokens: {
        total: 1,
        noCache: 1,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 8,
        text: 8,
        reasoning: undefined,
      },
    };
    const finishReason = { unified: "stop" as const, raw: undefined };
    const mock = new MockLanguageModelV3({
      doStream: async () => {
        const stream = textStreamFromParts([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: tid },
          {
            type: "text-delta",
            id: tid,
            delta: "Quiet breath—you closed the line and misère claims you.",
          },
          { type: "text-end", id: tid },
          { type: "finish", usage, finishReason },
        ]);
        return { stream };
      },
    });

    const { harness, app, deps } = await buildTestApp({
      commentaryMockModel: mock,
    });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token, {
      personality: "coach",
    });
    const live = await getSession(deps.redis, sessionId);
    expect(live).not.toBeNull();

    const board = ["X", "O", "X", "X", "X", "O", "O", "O", "X"] as const;
    const moveHistory = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
    const terminal: GameSession = {
      ...live!,
      board: [...board],
      moveHistory: [...moveHistory],
      currentPlayer: "O",
      result: { status: "loss", loser: "X" },
    };
    await saveCompletedSessionForAi(deps.redis, terminal);
    await deleteSession(deps.redis, sessionId);

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "terminal" }),
    });
    expect(res.status).toBe(200);
    expect(mock.doStreamCalls.length).toBeGreaterThan(0);
    const promptBlob = JSON.stringify(mock.doStreamCalls[0]);
    expect(promptBlob).toContain("Voice: warm mentor, post-game only");
    expect(promptBlob).toContain(
      "Outcome: you (X) just completed three-in-a-row",
    );
  });

  it("POST /ai/commentary terminal includes post-game draw voice for a draw snapshot", async () => {
    const tid = "t_terminal_draw";
    const usage = {
      inputTokens: {
        total: 1,
        noCache: 1,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 8,
        text: 8,
        reasoning: undefined,
      },
    };
    const finishReason = { unified: "stop" as const, raw: undefined };
    const mock = new MockLanguageModelV3({
      doStream: async () => {
        const stream = textStreamFromParts([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: tid },
          {
            type: "text-delta",
            id: tid,
            delta: "Nine squares, stillness holds.",
          },
          { type: "text-end", id: tid },
          { type: "finish", usage, finishReason },
        ]);
        return { stream };
      },
    });

    let drawState = createGame("expert");
    while (drawState.result.status === "in_progress") {
      drawState = makeMove(drawState, getAiMove(drawState));
    }
    expect(drawState.result).toEqual({ status: "draw" });

    const { harness, app, deps } = await buildTestApp({
      commentaryMockModel: mock,
    });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token, {
      personality: "coach",
    });
    const live = await getSession(deps.redis, sessionId);
    expect(live).not.toBeNull();

    const terminal: GameSession = {
      ...live!,
      board: drawState.board,
      moveHistory: [...drawState.moveHistory],
      currentPlayer: drawState.currentPlayer,
      result: drawState.result,
    };
    await saveCompletedSessionForAi(deps.redis, terminal);
    await deleteSession(deps.redis, sessionId);

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "terminal" }),
    });
    expect(res.status).toBe(200);
    const promptBlob = JSON.stringify(mock.doStreamCalls[0]);
    expect(promptBlob).toContain("Full board, no three-in-a-row");
    expect(promptBlob).toContain("Outcome: the board filled with no three-in-a-row");
  });

  it("POST /ai/commentary terminal returns 425 when session stays in_progress", async () => {
    const mock = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error("should not stream");
      },
    });
    const { harness, app, deps } = await buildTestApp({
      commentaryMockModel: mock,
    });
    const { token } = await harness.signInAnon();
    const { sessionId } = await startSession(app, token);

    const live = await getSession(deps.redis, sessionId);
    expect(live).not.toBeNull();
    await updateSession(deps.redis, {
      ...live!,
      result: { status: "in_progress" },
    });

    const res = await app.request("/ai/commentary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, trigger: "terminal" }),
    });
    expect(res.status).toBe(425);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("terminal_not_ready");
    expect(mock.doStreamCalls.length).toBe(0);
  });
});
