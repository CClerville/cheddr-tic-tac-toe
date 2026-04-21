import { z } from "zod";

export const DifficultySchema = z.enum(["beginner", "intermediate", "expert"]);
export type DifficultyDTO = z.infer<typeof DifficultySchema>;

export const PositionSchema = z
  .number()
  .int()
  .min(0)
  .max(8) as z.ZodType<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>;
export type PositionDTO = z.infer<typeof PositionSchema>;

export const PlayerSchema = z.enum(["X", "O"]);
export type PlayerDTO = z.infer<typeof PlayerSchema>;

export const CellValueSchema = z.union([PlayerSchema, z.null()]);
export type CellValueDTO = z.infer<typeof CellValueSchema>;

export const BoardSchema = z
  .array(CellValueSchema)
  .length(9) as z.ZodType<readonly CellValueDTO[]>;
export type BoardDTO = z.infer<typeof BoardSchema>;

export const GameOutcomeSchema = z.enum(["win", "loss", "draw"]);
export type GameOutcomeDTO = z.infer<typeof GameOutcomeSchema>;

export const GameResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("in_progress") }),
  z.object({ status: z.literal("loss"), loser: PlayerSchema }),
  z.object({ status: z.literal("draw") }),
]);
export type GameResultDTO = z.infer<typeof GameResultSchema>;
