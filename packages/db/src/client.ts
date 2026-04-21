import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Drizzle's per-driver `Database` types all extend the same `PgDatabase`
 * base. We deliberately widen here so the same `Database` interface is
 * satisfied by both the Neon HTTP driver (production) and PGlite (tests).
 * The structural query API is identical at the call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = PgDatabase<PgQueryResultHKT, typeof schema, any>;

/**
 * Create a Drizzle client backed by Neon's HTTP driver. The HTTP driver is
 * stateless, so calling this per-request on Vercel is cheap; reusing the
 * returned client across requests in a warm Fluid Compute instance is also
 * safe because there are no persistent connections to leak.
 */
export function createDb(databaseUrl: string): Database {
  const sql: NeonQueryFunction<false, false> = neon(databaseUrl);
  return drizzleNeon(sql, { schema }) as unknown as Database;
}

export { schema };
