/**
 * 碁盤の目にならない「ジグザグ」配置。
 *
 * 列ごとに半段ずらした六角格子（千鳥）に、ゆらぎを加える。
 * 最寄りのマスが斜め隣になるので、道が自然にジグザグにつながる。
 * 座標は 0〜1 の正規化値で返す（呼び出し側で % や -100〜100 に直す）。
 */

export interface StaggerOptions {
  /** Width / height of the area as it is shown (16/9 for the stage, 1 for a square). */
  aspect: number;
  /** Random source 0..1. */
  rng: () => number;
  /** Jitter as a fraction of cell spacing (0 = perfect lattice). */
  jitter?: number;
}

export function staggerDims(n: number, aspect: number): { cols: number; rows: number } {
  // Columns are packed tighter than rows so the diagonal is the nearest neighbour.
  const k = 1.8 * aspect;
  const rows = Math.max(2, Math.round(Math.sqrt(n / k)));
  const cols = Math.max(2, Math.ceil(n / rows));
  return { cols, rows };
}

export function staggeredPoints(n: number, opts: StaggerOptions): { x: number; y: number }[] {
  const { aspect, rng } = opts;
  const jitter = opts.jitter ?? 0.45;
  const { cols, rows } = staggerDims(n, aspect);
  const cells: { c: number; r: number }[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push({ c, r });
  // Drop extras from the rim (top/bottom corners), not from the middle, so the web stays whole.
  let extra = cells.length - n;
  const rim = cells
    .map((cell, i) => ({ i, cell, key: rng() }))
    .filter(({ cell }) => {
      const lowEdge = cell.r === 0 && cell.c % 2 === 0;
      const highEdge = cell.r === rows - 1 && cell.c % 2 === 1;
      return (lowEdge || highEdge) && cell.c > 0 && cell.c < cols - 1;
    })
    .sort((a, b) => a.key - b.key);
  const drop = new Set<number>();
  for (const { i } of rim) {
    if (extra <= 0) break;
    drop.add(i);
    extra--;
  }
  for (let i = cells.length - 1; extra > 0 && i >= 0; i--) {
    if (drop.has(i)) continue;
    drop.add(i);
    extra--;
  }
  const spanY = rows - 0.5;
  const sx = 1 / (cols - 1);
  const sy = 1 / spanY;
  const pts: { x: number; y: number }[] = [];
  cells.forEach((cell, i) => {
    if (drop.has(i)) return;
    const baseX = cell.c * sx;
    const baseY = (cell.r + (cell.c % 2 ? 0.5 : 0)) * sy;
    const jx = (rng() - 0.5) * jitter * sx;
    const jy = (rng() - 0.5) * jitter * sy;
    pts.push({
      x: Math.min(1, Math.max(0, baseX + jx)),
      y: Math.min(1, Math.max(0, baseY + jy)),
    });
  });
  return pts;
}
