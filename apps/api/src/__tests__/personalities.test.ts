import { describe, expect, it } from "vitest";

import {
  BOT_NAME,
  buildAiSystemPrompt,
} from "../lib/ai/personalities.js";

describe("buildAiSystemPrompt", () => {
  it("always includes Cheddr identity, second person, and misère rules", () => {
    const s = buildAiSystemPrompt({
      personality: "coach",
      playerName: null,
      purpose: "commentary",
    });
    expect(s).toContain(BOT_NAME);
    expect(s).toContain("You are");
    expect(s).toMatch(/Mis[eè]re|three in a row/i);
    expect(s).toContain("you");
  });

  it("includes player name and sparing-use instruction when playerName is set", () => {
    const s = buildAiSystemPrompt({
      personality: "coach",
      playerName: "Sam",
      purpose: "commentary",
    });
    expect(s).toContain('"Sam"');
    expect(s).toContain("sparingly");
  });

  it("does not contain the word human when playerName is null", () => {
    const s = buildAiSystemPrompt({
      personality: "zen_master",
      playerName: null,
      purpose: "hint",
    });
    expect(s.toLowerCase()).not.toMatch(/\bhuman\b/);
    expect(s).toContain("you");
  });

  it("coach voice includes mentor phrasing", () => {
    const s = buildAiSystemPrompt({
      personality: "coach",
      playerName: null,
      purpose: "commentary",
    });
    expect(s).toMatch(/let's|tiny tip/i);
  });

  it("trash_talk voice includes PG-13 and move-focused roast rule", () => {
    const s = buildAiSystemPrompt({
      personality: "trash_talk",
      playerName: null,
      purpose: "commentary",
    });
    expect(s).toContain("PG-13");
    expect(s).toMatch(/roast|Roast/);
  });

  it("zen_master voice caps length and forbids exclamation", () => {
    const s = buildAiSystemPrompt({
      personality: "zen_master",
      playerName: null,
      purpose: "commentary",
    });
    expect(s).toContain("14 words");
    expect(s).toContain("No exclamation marks");
  });

  it("sports_caster voice includes play-by-play and ALL-CAPS", () => {
    const s = buildAiSystemPrompt({
      personality: "sports_caster",
      playerName: null,
      purpose: "commentary",
    });
    expect(s).toMatch(/play-by-play|Play-by-play/);
    expect(s).toContain("ALL-CAPS");
  });
});
