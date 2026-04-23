import { z } from "zod";
import {
  BoardSchema,
  DifficultySchema,
  GameOutcomeSchema,
  GameResultSchema,
  PlayerSchema,
  PositionSchema,
} from "./primitives";
import { PersonalitySchema } from "./ai";

export const StartGameRequestSchema = z.object({
  difficulty: DifficultySchema,
  ranked: z.boolean().default(true),
  personality: PersonalitySchema.default("coach"),
});
export type StartGameRequest = z.infer<typeof StartGameRequestSchema>;

export const GameStateDTO = z.object({
  sessionId: z.string().uuid(),
  board: BoardSchema,
  currentPlayer: PlayerSchema,
  moveHistory: z.array(PositionSchema),
  result: GameResultSchema,
  difficulty: DifficultySchema,
  ranked: z.boolean(),
  personality: PersonalitySchema,
});
export type GameStateDTO = z.infer<typeof GameStateDTO>;

export const StartGameResponseSchema = GameStateDTO;
export type StartGameResponse = z.infer<typeof StartGameResponseSchema>;

export const MoveRequestSchema = z.object({
  sessionId: z.string().uuid(),
  position: PositionSchema,
});
export type MoveRequest = z.infer<typeof MoveRequestSchema>;

export const MoveResponseSchema = z.object({
  state: GameStateDTO,
  /** Position the AI played in response, if any. */
  aiMove: PositionSchema.nullable(),
  terminal: z.boolean(),
  outcome: GameOutcomeSchema.nullable(),
  /** ELO delta applied if the game just terminated and was ranked. */
  eloDelta: z.number().int().nullable(),
  /** Populated when `terminal` is true — use for post-game AI analysis. */
  gameId: z.string().uuid().nullable(),
});
export type MoveResponse = z.infer<typeof MoveResponseSchema>;

export const ResignRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type ResignRequest = z.infer<typeof ResignRequestSchema>;

export const ResignResponseSchema = z.object({
  state: GameStateDTO,
  outcome: GameOutcomeSchema,
  eloDelta: z.number().int(),
  gameId: z.string().uuid(),
});
export type ResignResponse = z.infer<typeof ResignResponseSchema>;
