/**
 * Design baseline (locked). See docs/design-baseline.md.
 * Keep in sync with CSS custom properties on :root / .game-stage.
 *
 * Font ladder is logical px on the 1280×720 stage. Transform scale shrinks
 * physical size; `.game-stage` applies a mild `--text-scale` boost when the
 * stage is scaled down so UI stays readable on phones without exploding layout.
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

/**
 * Font sizes (logical px at `--text-scale: 1`).
 * Raised so body/UI stay nearer ≥10–11 physical px at typical phone scale
 * (~0.35–0.5) once CSS `--text-scale` (~1.0–1.35) is applied.
 */
export const FONT = {
  caption: 12,
  body: 14,
  ui: 16,
  title: 24,
  displayMin: 38,
  displayMax: 46,
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
