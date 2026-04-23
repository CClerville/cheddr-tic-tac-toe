import { eq, sql } from "drizzle-orm";
import { createDb, schema, type Database } from "@cheddr/db";

import { getEnv } from "../env.js";

export type ReconcileUserRankedStatsResult = {
  /** Rows in `users`. */
  scanned: number;
  /** Users where ranked aggregates in `users` disagreed with `games`. */
  drifted: number;
  /** `UPDATE users` rows applied (always 0 when `dryRun` is true). */
  updated: number;
};

type RankedTruth = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

function zeroTruth(): RankedTruth {
  return { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
}

/**
 * Recompute `users.games_played`, `wins`, `losses`, `draws` from ranked
 * `games` rows only. Does **not** modify `users.elo` (path-dependent; cannot
 * be derived from outcomes alone).
 *
 * Run: `pnpm --filter @cheddr/api reconcile:stats` (see package.json).
 * Pass `--dry-run` to log diffs without writing; exits 1 if any drift found.
 */
export async function reconcileUserRankedStats(
  db: Database,
  options?: { dryRun?: boolean },
): Promise<ReconcileUserRankedStatsResult> {
  const dryRun = options?.dryRun ?? false;

  const grouped = await db
    .select({
      userId: schema.games.userId,
      gamesPlayed: sql<number>`count(*)::int`,
      wins: sql<number>`sum(case when ${schema.games.result} = 'win' then 1 else 0 end)::int`,
      losses: sql<number>`sum(case when ${schema.games.result} = 'loss' then 1 else 0 end)::int`,
      draws: sql<number>`sum(case when ${schema.games.result} = 'draw' then 1 else 0 end)::int`,
    })
    .from(schema.games)
    .where(eq(schema.games.ranked, true))
    .groupBy(schema.games.userId);

  const truthByUser = new Map<string, RankedTruth>();
  for (const row of grouped) {
    truthByUser.set(row.userId, {
      gamesPlayed: row.gamesPlayed,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      draws: row.draws ?? 0,
    });
  }

  const userRows = await db
    .select({
      id: schema.users.id,
      gamesPlayed: schema.users.gamesPlayed,
      wins: schema.users.wins,
      losses: schema.users.losses,
      draws: schema.users.draws,
    })
    .from(schema.users);

  let drifted = 0;
  let updated = 0;

  for (const row of userRows) {
    const t = truthByUser.get(row.id) ?? zeroTruth();
    const mismatch =
      row.gamesPlayed !== t.gamesPlayed ||
      row.wins !== t.wins ||
      row.losses !== t.losses ||
      row.draws !== t.draws;

    if (!mismatch) continue;

    drifted++;
    console.log(
      `[reconcile] drift user=${row.id} users=(${row.gamesPlayed}g ${row.wins}W/${row.losses}L/${row.draws}D) truth_from_games=(${t.gamesPlayed}g ${t.wins}W/${t.losses}L/${t.draws}D)`,
    );

    if (dryRun) continue;

    await db
      .update(schema.users)
      .set({
        gamesPlayed: t.gamesPlayed,
        wins: t.wins,
        losses: t.losses,
        draws: t.draws,
      })
      .where(eq(schema.users.id, row.id));
    updated++;
  }

  return { scanned: userRows.length, drifted, updated };
}

async function main(): Promise<number> {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to reconcile user stats");
  }
  const dryRun = process.argv.includes("--dry-run");
  const db = createDb(env.DATABASE_URL);
  const result = await reconcileUserRankedStats(db, { dryRun });
  console.log(
    `Reconcile ranked stats: scanned=${result.scanned} drifted=${result.drifted} updated=${result.updated}`,
  );
  return dryRun && result.drifted > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error("Reconcile failed:", err);
      process.exit(1);
    });
}
