import { z } from "zod";

export const AnonRequestSchema = z.object({
  /** Stable per-install device identifier (UUID v4 generated on first launch). */
  deviceId: z.string().min(8).max(128),
});
export type AnonRequest = z.infer<typeof AnonRequestSchema>;

export const AnonResponseSchema = z.object({
  token: z.string(),
  userId: z.string(),
  expiresAt: z.number().int().positive(),
});
export type AnonResponse = z.infer<typeof AnonResponseSchema>;

export const IdentitySchema = z.object({
  kind: z.enum(["clerk", "anon"]),
  id: z.string(),
  username: z.string().nullable(),
  elo: z.number().int(),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const MeResponseSchema = z.object({
  identity: IdentitySchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
