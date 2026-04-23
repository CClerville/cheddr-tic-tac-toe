import { describe, expect, it } from "vitest";

import { USERNAME_PATTERN } from "@cheddr/api-types";

describe("shared wire-format rules", () => {
  it("USERNAME_PATTERN matches valid handles", () => {
    expect(USERNAME_PATTERN.test("cheddr_player")).toBe(true);
    expect(USERNAME_PATTERN.test("ab")).toBe(false);
    expect(USERNAME_PATTERN.test("no spaces")).toBe(false);
  });
});
