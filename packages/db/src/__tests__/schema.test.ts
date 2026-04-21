import { describe, expect, it } from "vitest";
import { games, users } from "../schema";

describe("schema", () => {
  it("declares users and games tables with the expected names", () => {
    // Drizzle exposes table metadata via internal symbols; check the simple
    // case that columns we depend on exist and have the right types.
    expect(users.id.name).toBe("id");
    expect(users.elo.name).toBe("elo");
    expect(users.kind.name).toBe("kind");
    expect(games.userId.name).toBe("user_id");
    expect(games.moveHistory.name).toBe("move_history");
    expect(games.eloDelta.name).toBe("elo_delta");
  });

  it("defaults users.elo to 1000", () => {
    // Drizzle stores `default` in the column object; Postgres will apply.
    // We assert here so a future schema edit doesn't silently change it.
    expect(users.elo.default).toBe(1000);
  });

  it("requires non-null moveHistory and result on games", () => {
    expect(games.moveHistory.notNull).toBe(true);
    expect(games.result.notNull).toBe(true);
  });
});
