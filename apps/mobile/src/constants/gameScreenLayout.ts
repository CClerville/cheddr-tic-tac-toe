/** Horizontal inset per side; must match game screen padding. */
export const GAME_SCREEN_HORIZONTAL_INSET_PT = 16;

/** Total horizontal padding for window-width math (`inset * 2`). */
export const GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT =
  GAME_SCREEN_HORIZONTAL_INSET_PT * 2;

/**
 * Reserved vertical space for title, status, difficulty, play-again, and gaps.
 * Keep aligned with layout in `app/index.tsx`.
 */
export const GAME_SCREEN_LAYOUT_RESERVE_Y_PT = 360;
