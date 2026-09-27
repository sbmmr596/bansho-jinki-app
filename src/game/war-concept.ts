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
