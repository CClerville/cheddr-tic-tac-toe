import { z } from "zod";

import { PositionSchema } from "./primitives";

/** AI commentator / hint / analysis personality. */
export const PersonalitySchema = z.enum([
  "trash_talk",
  "coach",
  "zen_master",
  "sports_caster",
]);
export type Personality = z.infer<typeof PersonalitySchema>;

export const CommentaryRequestSchema = z.object({
  sessionId: z.string().uuid(),
  trigger: z.enum(["move", "terminal"]),
});
export type CommentaryRequest = z.infer<typeof CommentaryRequestSchema>;

export const HintRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type HintRequest = z.infer<typeof HintRequestSchema>;

export const HintResponseSchema = z.object({
  position: PositionSchema,
  reasoning: z.string(),
  /** 0–1 from the model; 0 when server fell back to engine move. */
  confidence: z.number().min(0).max(1),
  /** True when model output was invalid and engine best move was used. */
  fellBackToEngine: z.boolean(),
});
export type HintResponse = z.infer<typeof HintResponseSchema>;

export const AnalysisTurnSeveritySchema = z.enum([
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
]);
export type AnalysisTurnSeverity = z.infer<typeof AnalysisTurnSeveritySchema>;

export const AnalysisTurnSchema = z.object({
  /** 1-based move index in the completed game (first move = 1). */
  moveIndex: z.number().int().min(1).max(9),
  severity: AnalysisTurnSeveritySchema,
  comment: z.string(),
});
export type AnalysisTurn = z.infer<typeof AnalysisTurnSchema>;

export const AnalysisResponseSchema = z.object({
  summary: z.string(),
  turns: z.array(AnalysisTurnSchema),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export const AnalysisRequestSchema = z.object({
  gameId: z.string().uuid(),
});
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
