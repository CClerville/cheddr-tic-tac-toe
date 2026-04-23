import type { Profile } from "@cheddr/api-types";
import type { UserRow } from "@cheddr/db";

/** Project a `users` row into the public `Profile` wire type. */
export function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    kind: row.kind,
    username: row.username,
    displayName: row.displayName,
    avatarColor: row.avatarColor,
    elo: row.elo,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Postgres surfaces unique-constraint violations as SQLSTATE 23505. The
 * serverless driver re-throws the original error with `.code` preserved,
 * but we also fall back to a substring match in case a wrapper rewrites
 * the shape.
 */
export function isUniqueViolation(err: unknown): boolean {
  const codes = new Set<string>();
  const messages: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 12 && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      if (typeof o.code === "string") codes.add(o.code);
      if (typeof o.message === "string") messages.push(o.message);
      cur = o.cause ?? o.originalError ?? null;
    } else {
      break;
    }
  }
  if (codes.has("23505")) return true;
  return messages.some(
    (m) =>
      /duplicate key|unique constraint|violates unique constraint/i.test(m),
  );
}
