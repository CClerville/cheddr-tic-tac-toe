import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type {
  ExtractTablesWithRelations,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type SchemaModule = typeof schema;

/**
 * Drizzle's per-driver client types all extend the same `PgDatabase` base.
 * We pin the third generic to the `ExtractTablesWithRelations<schema>` shape
 * so the dotted query API (`db.query.users.findFirst`, etc.) stays typed,
 * and structurally satisfy both the Neon HTTP driver (production) and the
 * PGlite driver (tests) without ever needing `any` at the type level.
 */
export type Database = PgDatabase<
  PgQueryResultHKT,
  SchemaModule,
  ExtractTablesWithRelations<SchemaModule>
>;

/**
 * Drizzle's `RelationalSchemaConfig` shape — exposed so test harnesses can
 * narrow other drivers' clients to our shared `Database` alias without a
 * raw `any` cast.
 */
export type DbSchemaConfig = RelationalSchemaConfig<
  TablesRelationalConfig & ExtractTablesWithRelations<SchemaModule>
>;

/**
 * Create a Drizzle client backed by Neon's HTTP driver. The HTTP driver is
 * stateless, so calling this per-request on Vercel is cheap; reusing the
 * returned client across requests in a warm Fluid Compute instance is also
 * safe because there are no persistent connections to leak.
 */
export function createDb(databaseUrl: string): Database {
  const sql: NeonQueryFunction<false, false> = neon(databaseUrl);
  return drizzleNeon(sql, { schema });
}

export { schema };
