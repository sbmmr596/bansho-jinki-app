/**
 * Design baseline (locked). See docs/design-baseline.md.
 * Keep in sync with CSS custom properties on :root / .game-stage.
 *
 * Font ladder is logical px on the 1280×720 stage. Transform scale changes
 * physical size (contain fit may exceed 1 on large displays). `.game-stage`
 * applies a mild `--text-scale` boost only when the stage is scaled down so
 * UI stays readable on phones; at scale ≥ 1, text-scale stays 1.
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
 * caption/body/ui are +2px so on-stage copy stays readable without
 * restacking screens. Phone downscale still gets `--text-scale` (~1.0–1.35).
 */
export const FONT = {
  caption: 14,
  body: 16,
  ui: 18,
  title: 24,
  displayMin: 38,
  displayMax: 46,
} as const;

/** Minimum touch target (px) — physical after stage scale. */
export const TOUCH_MIN = 44;

/**
 * Button / chrome logical sizes on the 1280×720 stage.
 * iPhone 12 mini landscape contain ≈0.52 → bottom nav ~80h → ~42 CSS-px (modest trim from 88; still tappable).
 * Top chrome band ~72h filled with title / resources / 遊び方・内部 (Primary stays h-14).
 * Former right SideNav (10rem) removed so content uses full stage width.
 */
export const BTN = {
  primaryH: 56,
  primaryText: 16,
  opsH: 56,
  opsW: 56,
  opsText: 16,
  /** @deprecated vertical rail removed; kept for any leftover refs */
  sideNavW: 0,
  sideNavItemMinH: 0,
  sideNavText: 18,
  bottomNavH: 80,
  bottomNavText: 16,
  topBarH: 72,
} as const;

/** Base grid unit (px). Steps: 8 / 16 / 24 / 32. */
export const GRID = 8;

export const SPACE = {
  1: GRID, // 8
  2: GRID * 2, // 16
  3: GRID * 3, // 24
  4: GRID * 4, // 32
} as const;

/**
 * Contain-fit scale for the 1280×720 stage inside an available rectangle.
 * Uses the shorter side; **no max of 1** — large displays upscale (e.g. 1920×1080 → 1.5).
 * Letterbox only when viewport aspect ≠ 16:9.
 */
export function fitContainScale(availW: number, availH: number): number {
  const aw = Math.max(1, availW);
  const ah = Math.max(1, availH);
  return Math.min(aw / DESIGN_W, ah / DESIGN_H);
}

export type StageFrame = {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  stageLeft: number;
  stageTop: number;
  scale: number;
  /**
   * When true, stageLeft/Top are the center of the padded area and the stage
   * should use `translate(-50%,-50%) rotate(90deg) scale(...)` (portrait iframe
   * showing landscape content — Grok sandbox / phone preview debug aid).
   */
  rotate90: boolean;
};

/** Browser pinch-zoom. Keyboard resize keeps scale at 1 and must still follow the visual viewport. */
export function isPinchZoom(visualScale: number | undefined): boolean {
  return visualScale != null && Math.abs(visualScale - 1) > 0.01;
}

/**
 * Contain-fit scale when the 1280×720 stage is CSS-rotated 90° in a portrait
 * viewport: visual box is DESIGN_H×DESIGN_W.
 */
export function fitContainScaleRotated(availW: number, availH: number): number {
  const aw = Math.max(1, availW);
  const ah = Math.max(1, availH);
  return Math.min(aw / DESIGN_H, ah / DESIGN_W);
}

/**
 * Place the 1280×720 stage in the visible window.
 * Pinch-zoom reports a smaller visual viewport and a pan offset that collapses
 * toward the layout origin, so the board jumps to the top-left. Ignore that
 * pan and keep the layout-viewport fit until the zoom is cleared.
 *
 * `pseudoLandscape`: in a portrait frame, rotate the stage 90° and fit using
 * the swapped visual box so sandbox/phone previews can review landscape UI.
 */
export function stageFrame(opts: {
  innerWidth: number;
  innerHeight: number;
  visualWidth?: number;
  visualHeight?: number;
  offsetLeft?: number;
  offsetTop?: number;
  visualScale?: number;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  pseudoLandscape?: boolean;
}): StageFrame {
  const pinch = isPinchZoom(opts.visualScale);
  const rawW = pinch ? opts.innerWidth : (opts.visualWidth ?? opts.innerWidth);
  const rawH = pinch ? opts.innerHeight : (opts.visualHeight ?? opts.innerHeight);
  const padL = opts.padL ?? 0;
  const padR = opts.padR ?? 0;
  const padT = opts.padT ?? 0;
  const padB = opts.padB ?? 0;
  const aw = Math.max(1, rawW - padL - padR);
  const ah = Math.max(1, rawH - padT - padB);
  const frameLeft = pinch ? 0 : (opts.offsetLeft ?? 0);
  const frameTop = pinch ? 0 : (opts.offsetTop ?? 0);
  const frameWidth = Math.floor(rawW);
  const frameHeight = Math.floor(rawH);
  const portrait = frameHeight > frameWidth;
  if (opts.pseudoLandscape && portrait) {
    const scale = fitContainScaleRotated(aw, ah);
    return {
      frameLeft,
      frameTop,
      frameWidth,
      frameHeight,
      stageLeft: padL + aw / 2,
      stageTop: padT + ah / 2,
      scale,
      rotate90: true,
    };
  }
  const scale = fitContainScale(aw, ah);
  return {
    frameLeft,
    frameTop,
    frameWidth,
    frameHeight,
    stageLeft: padL + (aw - DESIGN_W * scale) / 2,
    stageTop: padT + (ah - DESIGN_H * scale) / 2,
    scale,
    rotate90: false,
  };
}
