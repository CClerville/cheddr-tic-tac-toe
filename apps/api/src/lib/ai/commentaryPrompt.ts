import type { Board, GameResult, Position } from "@cheddr/game-engine";

import {
  formatCellLegend,
  formatLatestMoveLine,
  formatMoveHistory,
  serializeBoard,
} from "./board.js";

/** Shared user message body for `/ai/commentary` and offline eval. */
export function buildCommentaryUserPrompt(args: {
  board: Board;
  moveHistory: readonly Position[];
  result: GameResult;
  trigger: string;
}): string {
  return [
    formatCellLegend(),
    ``,
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
  ].join("\n");
}
