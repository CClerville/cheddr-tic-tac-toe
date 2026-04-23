import type { Board, Position } from "@cheddr/game-engine";

import {
  CELL_NAMES,
  cellNameForPosition,
  lastHumanMovePosition,
} from "./board.js";

export type CommentaryValidationReason =
  | "phantom_cell"
  | "wrong_owner"
  | "stale_cell";

export type CommentaryValidationResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: CommentaryValidationReason };

function escapeRegexToken(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names sorted longest-first so e.g. `middle-right` wins over substring issues. */
const CELL_NAME_PATTERN: RegExp = (() => {
  const sorted = [...CELL_NAMES].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${sorted.map(escapeRegexToken).join("|")})\\b`, "gi");
})();

export function extractReferencedCells(text: string): Position[] {
  const found = new Set<number>();
  CELL_NAME_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CELL_NAME_PATTERN.exec(text)) !== null) {
    const name = m[1]!.toLowerCase();
    const idx = CELL_NAMES.findIndex((c) => c === name);
    if (idx >= 0) found.add(idx);
  }
  return [...found] as Position[];
}

function sliceAroundCellMention(text: string, name: string): string {
  const lower = text.toLowerCase();
  const n = name.toLowerCase();
  const idx = lower.indexOf(n);
  if (idx < 0) return "";
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + name.length + 50);
  return text.slice(start, end).toLowerCase();
}

function allowsEmptySquareMention(text: string, cellName: string): boolean {
  const slice = sliceAroundCellMention(text, cellName);
  return /\b(open|empty|available|free|still|wide)\b/.test(slice);
}

function lastHumanMoveLabel(moveHistory: readonly Position[]): string | null {
  const pos = lastHumanMovePosition(moveHistory);
  return pos == null ? null : cellNameForPosition(pos);
}

/** Line appended to Redis when the model text fails spatial validation. */
export function commentaryFallbackLine(
  moveHistory: readonly Position[],
): string {
  const label = lastHumanMoveLabel(moveHistory);
  if (!label) return "Solid play so far. Let's see how this unfolds.";
  return `Solid move at ${label}. Let's see how this unfolds.`;
}

export function validateCommentary(
  text: string,
  board: Board,
  moveHistory: readonly Position[],
): CommentaryValidationResult {
  const cited = extractReferencedCells(text);
  const lower = text.toLowerCase();

  for (const i of cited) {
    if (board[i] === null) {
      const name = CELL_NAMES[i];
      if (!allowsEmptySquareMention(text, name)) {
        return { ok: false, reason: "phantom_cell" };
      }
    }
  }

  for (const i of cited) {
    if (board[i] === "O" && /\b(your|you)\b/i.test(text) && /\bx\b/i.test(lower)) {
      return { ok: false, reason: "wrong_owner" };
    }
    if (board[i] === "X" && /\bmy\b/i.test(lower) && /\bo\b/i.test(lower)) {
      return { ok: false, reason: "wrong_owner" };
    }
  }

  const lastX = lastHumanMovePosition(moveHistory);
  if (
    lastX != null &&
    /\b(just|placed|played)\b/i.test(text) &&
    /\b(your|you)\b/i.test(text)
  ) {
    for (const i of cited) {
      if (board[i] === "X" && i !== lastX) {
        return { ok: false, reason: "stale_cell" };
      }
    }
  }

  return { ok: true };
}

export function selectPersistedCommentary(
  rawText: string,
  board: Board,
  moveHistory: readonly Position[],
): { text: string; usedFallback: boolean; reason?: CommentaryValidationReason } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { text: "", usedFallback: false };
  }
  const v = validateCommentary(trimmed, board, moveHistory);
  if (v.ok) {
    return { text: trimmed, usedFallback: false };
  }
  return {
    text: commentaryFallbackLine(moveHistory),
    usedFallback: true,
    reason: v.reason,
  };
}
