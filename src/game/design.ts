/**
 * Design baseline (locked). See docs/design-baseline.md.
 * Keep in sync with CSS custom properties on :root / .game-stage.
 */

/** Stage logical size (px). */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/** Inner content safe inset on stage (px). Safe-area env stays on outer letterbox only. */
export const CONTENT_SAFE_INSET = 24;
export const CONTENT_SAFE_W = DESIGN_W - CONTENT_SAFE_INSET * 2; // 1232
export const CONTENT_SAFE_H = DESIGN_H - CONTENT_SAFE_INSET * 2; // 672

/** Card aspect width:height = 2:3 */
export const CARD_ASPECT_W = 2;
export const CARD_ASPECT_H = 3;

/** Master card art resolution (px). */
export const CARD_MASTER_W = 1152;
export const CARD_MASTER_H = 1728;

/** Card face display widths (px). Height = width * 3/2. */
export const CARD_W = {
  mini: 48,
  xs: 76,
  sm: 100,
  md: 120,
  lg: 160,
} as const;

export type CardSizeKey = keyof typeof CARD_W;

/** Font sizes (logical px). */
export const FONT = {
  caption: 10,
  body: 12,
  ui: 14,
  title: 22,
  displayMin: 36,
  displayMax: 44,
} as const;

/** Minimum touch target (px). */
export const TOUCH_MIN = 44;

/** Base grid unit (px). Steps: 8 / 16 / 24 / 32. */
export const GRID = 8;

export const SPACE = {
  1: GRID, // 8
  2: GRID * 2, // 16
  3: GRID * 3, // 24
  4: GRID * 4, // 32
} as const;
