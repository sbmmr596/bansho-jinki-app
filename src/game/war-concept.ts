import { staggeredPoints } from "./stagger";

/**
 * 多人数で陣取りするモードの構想。プレイはまだ作らない。
 * 神羅大戦のように、一つの環境の上を点と線で進む。
 * 座標は -100〜100。マスと拠点は、その正方形に対して同じくらいの密度にする。
 */
export const WAR_CONCEPT = {
  status: "concept" as const,
  coordMin: -100,
  coordMax: 100,
  /** 一辺 200 に対し、空きすぎず詰まりすぎない数。 */
  cells: 96,
  /** マスのおよそ 1/6。一人用（5/30〜10/50）と同じ比率。 */
  strongholds: 16,
  oneFieldPerMap: true,
} as const;

export function warConceptBalanced(): boolean {
  const span = WAR_CONCEPT.coordMax - WAR_CONCEPT.coordMin;
  const ratio = WAR_CONCEPT.strongholds / WAR_CONCEPT.cells;
  const spacing = span / Math.sqrt(WAR_CONCEPT.cells);
  return (
    WAR_CONCEPT.coordMin === -100 &&
    WAR_CONCEPT.coordMax === 100 &&
    ratio >= 1 / 8 &&
    ratio <= 1 / 4 &&
    spacing >= 12 &&
    spacing <= 28
  );
}


/**
 * 構想段階の陣取りマップ配置（-100〜100）。一人用と同じくジグザグ（千鳥）に並べ、碁盤の目にしない。
 * 画面はまだ無いので、座標だけを返す。
 */
export function warConceptLayout(seed = 1): { x: number; y: number }[] {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const span = WAR_CONCEPT.coordMax - WAR_CONCEPT.coordMin;
  const pad = 0.06;
  return staggeredPoints(WAR_CONCEPT.cells, { aspect: 1, rng }).map((p) => ({
    x: Math.round((WAR_CONCEPT.coordMin + (pad + p.x * (1 - pad * 2)) * span) * 10) / 10,
    y: Math.round((WAR_CONCEPT.coordMin + (pad + p.y * (1 - pad * 2)) * span) * 10) / 10,
  }));
}
