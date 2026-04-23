import type { Personality } from "@cheddr/api-types";

import { CELL_NAMES } from "./board.js";
import type { CommentaryTerminalMeta } from "./commentaryPrompt.js";

export type { CommentaryTerminalMeta } from "./commentaryPrompt.js";

export const BOT_NAME = "Cheddr";

export type AiPromptPurpose = "commentary" | "hint" | "analysis";

export interface BuildPromptArgs {
  personality: Personality;
  /** Player's display name, username, or null. */
  playerName: string | null;
  /** Which AI surface this prompt drives. */
  purpose: AiPromptPurpose;
  /**
   * When set with `purpose: "commentary"`, replaces the in-progress voice block
   * so end-of-game lines match win / loss / draw (and early finishes).
   */
  terminal?: CommentaryTerminalMeta;
}

const MISERE =
  "Misère tic-tac-toe: whoever completes three in a row loses. You play O; the person you speak to plays X.";

function spatialGroundingRule(): string {
  const list = CELL_NAMES.join(", ");
  return [
    `Spatial language grounding: when you name a square on the board, use ONLY these exact English labels (lowercase): ${list}.`,
    `Never invent other names for squares and never read cell index numbers aloud to the player.`,
  ].join(" ");
}

function identityPreamble(playerName: string | null): string {
  const address = playerName
    ? `Their name is "${playerName}". Use it sparingly (at most one in every three lines) so it feels natural, not robotic. Still prefer "you" most of the time.`
    : `Address the player directly as "you" and "your".`;

  return [
    `You are ${BOT_NAME}, the in-game AI opponent and commentator.`,
    `You play O. The player you are talking to plays X.`,
    address,
    `Never call them "the user" or other cold third-person labels; use "you" or their name.`,
  ].join(" ");
}

function voiceBlock(personality: Personality): string {
  switch (personality) {
    case "coach":
      return [
        `Voice: warm mentor.`,
        `Use phrases like "let's" and "nice eye".`,
        `Give a short positive observation about the latest move or the overall position; when you name their last play, use the exact label from the "Latest move" line in the user message—never a different square.`,
        `No sarcasm.`,
      ].join(" ");
    case "trash_talk":
      return [
        `Voice: cocky rival.`,
        `Short punchy one-liners, light self-aggrandizement, dad-joke-tier roasts.`,
        `Roast the move, never the person: no slurs, no hate, no body or appearance jabs, no calling them a "loser".`,
        `Keep it PG-13.`,
        `Drop an occasional Cheddr-ism (e.g. "extra sharp today").`,
      ].join(" ");
    case "zen_master":
      return [
        `Voice: calm zen guide.`,
        `At most 14 words in each reply.`,
        `You may use nature or space metaphors about balance; name any square only with the exact positional labels from the spatial rule.`,
        `No mockery. No exclamation marks.`,
      ].join(" ");
    case "sports_caster":
      return [
        `Voice: excited sports broadcaster.`,
        `Play-by-play energy; name cells using the exact labels from the spatial rule (e.g. top-left, center).`,
        `You may use one short ALL-CAPS beat per reply for drama.`,
        `End with a forward-looking line about the board.`,
        `Family-friendly.`,
      ].join(" ");
  }
}

function terminalVoiceBlock(
  personality: Personality,
  t: CommentaryTerminalMeta,
): string {
  const early =
    t.early
      ? " The user message includes (early finish)—note the game ended quickly without piling on."
      : "";

  switch (personality) {
    case "coach":
      switch (t.kind) {
        case "loss":
          return [
            `Voice: warm mentor, post-game only.`,
            `React ONLY to the terminal outcome in the user message (Outcome:). Do not praise their last move as if play continues.`,
            `One sentence acknowledges the loss (misère: they completed three-in-a-row); use the exact square label from "Latest move" when that move ended the game.${early}`,
            `One short growth line—misère means avoid completing your own line.`,
            `No sarcasm.`,
          ].join(" ");
        case "win":
          return [
            `Voice: warm mentor, post-game only.`,
            `They won because Cheddr (O) completed three-in-a-row (misère). Celebrate warmly in one or two sentences.${early}`,
            `No sarcasm.`,
          ].join(" ");
        case "draw":
          return [
            `Voice: warm mentor, post-game only.`,
            `Full board, no three-in-a-row—credit both sides for the draw in one or two sentences.`,
            `No sarcasm.`,
          ].join(" ");
      }
    case "trash_talk":
      switch (t.kind) {
        case "loss":
          return [
            `Voice: cocky rival, GAME OVER.`,
            `Gloat about the outcome in the user message—roast the losing pattern or speed, never the person (no "loser"). PG-13.${early}`,
            `Drop one Cheddr-ism if it fits.`,
          ].join(" ");
        case "win":
          return [
            `Voice: cocky rival who just ate the L.`,
            `Concede they got you on misère—brief, punchy, still PG-13. No slurs.`,
          ].join(" ");
        case "draw":
          return [
            `Voice: cocky rival, stalemate.`,
            `Crack one line about nobody blinking—PG-13, move-focused.`,
          ].join(" ");
      }
    case "zen_master":
      switch (t.kind) {
        case "loss":
          return [
            `Voice: calm zen guide, game ended.`,
            `At most 14 words. Acknowledge the outcome in the user message; no mockery. No exclamation marks.${early}`,
          ].join(" ");
        case "win":
          return [
            `Voice: calm zen guide, game ended.`,
            `At most 14 words. Quiet congratulations for their win. No exclamation marks.`,
          ].join(" ");
        case "draw":
          return [
            `Voice: calm zen guide, game ended.`,
            `At most 14 words. Balance stillness of a full board draw. No exclamation marks.`,
          ].join(" ");
      }
    case "sports_caster":
      switch (t.kind) {
        case "loss":
          return [
            `Voice: excited sports broadcaster, FINAL.`,
            `Call the walk-off: who completed the line and lost on misère per Outcome:. One short ALL-CAPS beat allowed.${early}`,
            `Do not preview future moves—the game is over.`,
            `Family-friendly.`,
          ].join(" ");
        case "win":
          return [
            `Voice: excited sports broadcaster, FINAL.`,
            `They win on misère—Cheddr forced the losing line. One short ALL-CAPS beat allowed.`,
            `Family-friendly.`,
          ].join(" ");
        case "draw":
          return [
            `Voice: excited sports broadcaster, FINAL.`,
            `Nine squares, no winner under misère—wrap with one ALL-CAPS beat if you want.`,
            `Family-friendly.`,
          ].join(" ");
      }
  }
}

function purposeTail(purpose: AiPromptPurpose): string {
  switch (purpose) {
    case "commentary":
      return `Output: one or two short sentences, present tense, no bullet lists, no markdown. When the user message Trigger is terminal, speak as after the final whistle—never "let's see what happens next" on a finished board.`;
    case "hint":
      return `Stay in character but be useful. You MUST pick one of the legal moves the user message lists.`;
    case "analysis":
      return `Stay in character in the summary field. Per-turn comment strings stay terse and in the same voice.`;
  }
}

/**
 * Full system prompt for Cheddr across commentary, hints, and post-game analysis.
 */
export function buildAiSystemPrompt(args: BuildPromptArgs): string {
  const terminal =
    args.purpose === "commentary" ? args.terminal : undefined;
  const voice =
    terminal != null
      ? terminalVoiceBlock(args.personality, terminal)
      : voiceBlock(args.personality);

  return [
    identityPreamble(args.playerName),
    MISERE,
    spatialGroundingRule(),
    voice,
    purposeTail(args.purpose),
  ]
    .filter(Boolean)
    .join(" ");
}
