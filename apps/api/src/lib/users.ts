import { eq } from "drizzle-orm";

import { schema, type Database } from "@cheddr/db";

/**
 * Display name for AI personalization: prefers profile display name, then @username.
 */
export async function getPlayerName(
  db: Database,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      displayName: schema.users.displayName,
      username: schema.users.username,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!row) return null;

  const display = row.displayName?.trim();
  if (display) return display;

  const user = row.username?.trim();
  return user || null;
}
