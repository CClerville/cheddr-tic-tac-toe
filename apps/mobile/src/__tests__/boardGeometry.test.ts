import { describe, expect, it } from "vitest";

import { createBoardGeometry, getCellRect } from "@/components/board/boardGeometry";

describe("boardGeometry", () => {
  it("creates consistent cell rects for a square board", () => {
    const g = createBoardGeometry(300);
    expect(g.size).toBe(300);
    expect(g.cellSize).toBe(100);
    const r = getCellRect(g, 4);
    expect(r.centerX).toBeGreaterThan(0);
    expect(r.centerY).toBeGreaterThan(0);
  });
});
