import type { FieldKind } from "./types";

/**
 * 戦闘背景の「空を狭く・地面を広く」する切り出し。
 *
 * 元絵は地平線が画面の中ほど〜下にあるため、上段のキャラが空に浮いて見えた。
 * 空は上を切り落とし（縦に潰さない）、地面は地平線から下を縦に伸ばして、
 * 地平線をステージ上端寄り（HORIZON_TARGET）に持ってくる。
 */

/** Battle keeps the earlier photos. New map terrains reuse the closest of those. */
export const BATTLE_FIELD_SRC: Record<FieldKind, string> = {
  grass: "/bg/grass.jpg",
  desert: "/bg/field.jpg",
  snow: "/bg/snow.jpg",
  ice: "/bg/snow.jpg",
  forest: "/bg/forest.jpg",
  volcano: "/bg/magma.jpg",
  waste: "/bg/field.jpg",
  magma: "/bg/magma.jpg",
};

export interface BackdropArt {
  /** Source pixel size. */
  w: number;
  h: number;
  /** Ground line in the source, 0 (top) .. 1 (bottom). */
  horizon: number;
}

/** 地平線（地面が始まる高さ）の実測値。 */
export const BACKDROP_ART: Record<string, BackdropArt> = {
  "/bg/grass.jpg": { w: 1792, h: 1008, horizon: 0.47 },
  "/bg/field.jpg": { w: 1792, h: 1008, horizon: 0.5 },
  "/bg/snow.jpg": { w: 1792, h: 1008, horizon: 0.68 },
  "/bg/forest.jpg": { w: 1792, h: 1008, horizon: 0.6 },
  "/bg/magma.jpg": { w: 1792, h: 1008, horizon: 0.58 },
};

/** Stage size the battle is laid out on. */
export const BACKDROP_W = 1280;
export const BACKDROP_H = 720;
/** Where the ground line lands on the stage (fraction of height). Top-row feet sit near 0.35. */
export const HORIZON_TARGET = 0.24;
/** Max uniform zoom so art stays sharp; the rest is taken by stretching the ground. */
export const MAX_ZOOM = 1.4;

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BackdropLayout {
  /** Screen height of the sky band (0 .. horizonY). */
  horizonY: number;
  sky: ViewBox;
  ground: ViewBox;
  zoom: number;
  /** Extra vertical stretch applied to the ground band (1 = none). */
  stretch: number;
}

export function backdropLayout(
  art: BackdropArt,
  stageW = BACKDROP_W,
  stageH = BACKDROP_H,
  target = HORIZON_TARGET,
  maxZoom = MAX_ZOOM,
): BackdropLayout {
  // Scale at which the art just covers the stage.
  const cover = Math.max(stageW / art.w, stageH / art.h);
  const horizonSrc = art.horizon * art.h;
  const groundSrc = art.h - horizonSrc;
  const groundScreen = stageH * (1 - target);
  // Zoom needed so the ground fills the lower band without stretching.
  const need = groundScreen / (groundSrc * cover);
  const zoom = Math.min(maxZoom, Math.max(1, need));
  const px = cover * zoom; // screen px per source px (uniform part)
  const visW = stageW / px;
  const x = (art.w - visW) / 2;
  const horizonY = stageH * target;
  const skySrcH = horizonY / px;
  const sky: ViewBox = { x, y: Math.max(0, horizonSrc - skySrcH), w: visW, h: Math.min(horizonSrc, skySrcH) };
  const ground: ViewBox = { x, y: horizonSrc, w: visW, h: groundSrc };
  const stretch = groundScreen / (groundSrc * px);
  return { horizonY, sky, ground, zoom, stretch };
}
