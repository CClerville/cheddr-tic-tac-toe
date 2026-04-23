/**
 * Offline eval: call the live Gateway model on commentary fixtures and measure
 * how often `validateCommentary` accepts the output (spatial grounding).
 *
 * Usage (from repo root):
 *   pnpm --filter @cheddr/api eval:commentary
 *
 * Requires `AI_GATEWAY_API_KEY` (and optional `AI_MODEL_COMMENTARY`) in env,
 * e.g. via `tsx --env-file=apps/api/.env.local`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gateway } from "@ai-sdk/gateway";
import type { GatewayModelId } from "@ai-sdk/gateway";
import type { Board, GameResult, Position } from "@cheddr/game-engine";
import { generateText } from "ai";

import { buildCommentaryUserPrompt } from "../lib/ai/commentaryPrompt.js";
import { validateCommentary } from "../lib/ai/commentaryGuard.js";
import { buildAiSystemPrompt } from "../lib/ai/personalities.js";
import { getEnv } from "../env.js";

const THRESHOLD = 0.9;

type FixtureRow = {
  id: string;
  board: (null | "X" | "O")[];
  moveHistory: number[];
  trigger: string;
  result?: GameResult;
};

function fixturePath(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(dir, "../__tests__/fixtures/commentary-eval.json");
}

function asBoard(raw: (null | "X" | "O")[]): Board {
  if (raw.length !== 9) throw new Error("board must have length 9");
  return raw as unknown as Board;
}

function asPositions(raw: number[]): readonly Position[] {
  return raw.map((n) => n as Position);
}

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    console.error(
      "evalCommentary: set AI_GATEWAY_API_KEY (e.g. tsx --env-file=apps/api/.env.local …)",
    );
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(fixturePath(), "utf8")) as FixtureRow[];
  const env = getEnv();
  const modelId = (env.AI_MODEL_COMMENTARY ??
    env.AI_MODEL ??
    "openai/gpt-4.1-mini") as GatewayModelId;
  const model = gateway(modelId);
  const system = buildAiSystemPrompt({
    personality: "coach",
    playerName: null,
    purpose: "commentary",
  });

  let pass = 0;
  const rows: { id: string; ok: boolean; snippet: string }[] = [];

  for (const f of raw) {
    const board = asBoard(f.board);
    const moveHistory = asPositions(f.moveHistory);
    const result: GameResult = f.result ?? { status: "in_progress" };
    const prompt = buildCommentaryUserPrompt({
      board,
      moveHistory,
      result,
      trigger: f.trigger,
    });

    let text = "";
    try {
      const out = await generateText({
        model,
        system,
        prompt,
        maxOutputTokens: 120,
      });
      text = out.text.trim();
    } catch (e) {
      console.error(`[${f.id}] generateText failed`, e);
      rows.push({ id: f.id, ok: false, snippet: "(provider error)" });
      continue;
    }

    const v = validateCommentary(text, board, moveHistory);
    const ok = v.ok;
    if (ok) pass += 1;
    rows.push({
      id: f.id,
      ok,
      snippet: text.slice(0, 80).replace(/\s+/g, " "),
    });
  }

  const rate = pass / raw.length;
  console.table(rows);
  console.log(
    `Pass rate: ${pass}/${raw.length} (${(rate * 100).toFixed(1)}%) model=${modelId} threshold=${THRESHOLD * 100}%`,
  );

  if (rate < THRESHOLD) {
    console.error("evalCommentary: pass rate below threshold");
    process.exit(1);
  }
}

void main();
