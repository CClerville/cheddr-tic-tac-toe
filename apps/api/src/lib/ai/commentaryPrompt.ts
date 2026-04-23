import type { Board, GameResult, Position } from "@cheddr/game-engine";

import {
  formatCellLegend,
  formatLatestMoveLine,
  formatMoveHistory,
  serializeBoard,
} from "./board.js";

/** Player win / loss / draw from the human (X) perspective; used for terminal commentary. */
export type CommentaryTerminalKind = "win" | "loss" | "draw";

export type CommentaryTerminalMeta = {
  kind: CommentaryTerminalKind;
  early: boolean;
};

/**
 * Maps engine `GameResult` to human-centric terminal metadata for prompts.
 * `early` means few moves (snappy game) so the model can dial tone.
 */
export function terminalKindFromResult(
  result: GameResult,
  moveHistory: readonly Position[],
): CommentaryTerminalMeta | undefined {
  if (result.status === "in_progress") return undefined;
  const early = moveHistory.length <= 5;
  if (result.status === "draw") return { kind: "draw", early };
  return {
    kind: result.loser === "X" ? "loss" : "win",
    early,
  };
}

function formatTerminalOutcomeLines(
  result: GameResult,
  moveHistory: readonly Position[],
): string[] {
  const n = moveHistory.length;
  const earlySuffix = n <= 5 ? " (early finish)" : "";
  const moveLine = `Game ended on move ${n} of 9${earlySuffix}.`;
  if (result.status === "in_progress") {
    return [moveLine];
  }
  if (result.status === "draw") {
    return [
      "Outcome: the board filled with no three-in-a-row — it's a draw.",
      moveLine,
    ];
  }
  if (result.loser === "X") {
    return [
      "Outcome: you (X) just completed three-in-a-row, so you lose this game.",
      moveLine,
    ];
  }
  return [
    "Outcome: Cheddr (O) was forced to complete three-in-a-row, so you win.",
    moveLine,
  ];
}

/** Shared user message body for `/ai/commentary` and offline eval. */
export function buildCommentaryUserPrompt(args: {
  board: Board;
  moveHistory: readonly Position[];
  result: GameResult;
  trigger: string;
}): string {
  const parts: string[] = [formatCellLegend(), ``];

  if (args.trigger === "terminal") {
    parts.push(
      ...formatTerminalOutcomeLines(args.result, args.moveHistory),
      ``,
    );
  }

  parts.push(
    `Board:`,
    serializeBoard(args.board),
    ``,
    `Move log:`,
    formatMoveHistory(args.moveHistory),
    ``,
    formatLatestMoveLine(args.moveHistory),
    `Game result JSON: ${JSON.stringify(args.result)}`,
    `Trigger: ${args.trigger}.`,
    ``,
    `Comment on this position from your perspective as Cheddr. Speak to the player directly.`,
    `If you reference a square, use the exact label that appears in "Latest move" when describing their last play.`,
  );

  return parts.join("\n");
}
