import { FODDER_CARDS } from "./data";
import { RANK_META, rankIndex, type PlayerRank } from "./rank";
import type { ElementType, EnemyUnit, FieldKind, MapNode } from "./types";

/** 拠点は数回勝たないと占領できない。開発中の固定値。 */
export const STRONGHOLD_WINS = 3;

/** 地形は見た目だけ。難易度の差はない。 */
export const SOLO_FIELDS: FieldKind[] = ["grass", "desert", "snow", "ice", "forest", "volcano"];

export const FIELD_LABEL: Record<FieldKind, string> = {
  grass: "草原",
  desert: "砂漠",
  snow: "雪原",
  ice: "氷原",
  forest: "森林",
  volcano: "火山",
  waste: "荒野",
  magma: "岩漿",
};

/** Ground art for the map and the battle of that stage. */
export const FIELD_SRC: Record<FieldKind, string> = {
  grass: "/bg/terrain-grass.jpg",
  desert: "/bg/terrain-desert.jpg",
  snow: "/bg/terrain-snow.jpg",
  ice: "/bg/terrain-ice.jpg",
  forest: "/bg/terrain-forest.jpg",
  volcano: "/bg/terrain-volcano.jpg",
  waste: "/bg/terrain-desert.jpg",
  magma: "/bg/terrain-volcano.jpg",
};

/** Shown under the image while it loads. */
export const FIELD_BOARD: Record<FieldKind, string> = {
  grass: "#243828",
  desert: "#8a6840",
  snow: "#c8d0d8",
  ice: "#8eb4c8",
  forest: "#1a2c24",
  volcano: "#3a2420",
  waste: "#8a6840",
  magma: "#3a2420",
};

const HOLD_NAMES = ["関所", "砦", "塔", "社", "陣", "城", "港", "嶺", "丘", "原"] as const;
const HOLD_SHORT = ["関", "砦", "塔", "社", "陣", "城", "港", "嶺", "丘", "原"] as const;

const HINTS: ElementType[] = ["power", "skill", "magic", "void", "heaven", "earth"];

export interface SoloStage {
  rank: PlayerRank;
  stage: number;
  field: FieldKind;
  nodes: MapNode[];
  byId: Record<string, MapNode>;
  homeId: string;
}

const cache = new Map<string, SoloStage>();

export function soloStage(rank: PlayerRank, stage: number): SoloStage {
  const key = `${rank}:${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const built = buildSoloStage(rank, stage);
  cache.set(key, built);
  return built;
}

export function findStageNode(rank: PlayerRank, stage: number, id: string): MapNode | null {
  return soloStage(rank, stage).byId[id] ?? null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stageSeed(rank: PlayerRank, stage: number): number {
  let h = 2166136261;
  const s = `${rank}:${stage}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function link(adj: number[][], a: number, b: number) {
  if (a === b || adj[a].includes(b)) return;
  adj[a].push(b);
  adj[b].push(a);
}

/** Even lattice inside the rank's field — balanced spacing like the earlier board. */
function evenPositions(n: number, rng: () => number, spread: number): { x: number; y: number }[] {
  const aspect = 16 / 9;
  let cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
  let rows = Math.max(2, Math.ceil(n / cols));
  while (cols * rows < n) rows++;
  const use = new Array<boolean>(cols * rows).fill(true);
  let extra = cols * rows - n;
  const stride = extra > 0 ? (cols * rows) / extra : 0;
  for (let k = 0; k < extra; k++) {
    let idx = Math.min(cols * rows - 1, Math.floor((k + 0.5) * stride));
    while (!use[idx] && idx > 0) idx--;
    use[idx] = false;
  }
  const margin = (1 - spread) / 2;
  // Mild jitter so cells stay evenly spaced (older board feel).
  const jitter = 0.12;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!use[r * cols + c]) continue;
      const gx = cols === 1 ? 0.5 : c / (cols - 1);
      const gy = rows === 1 ? 0.5 : r / (rows - 1);
      const jx = ((rng() - 0.5) * jitter) / Math.max(1, cols - 1);
      const jy = ((rng() - 0.5) * jitter) / Math.max(1, rows - 1);
      const x = (margin + Math.min(1, Math.max(0, gx + jx)) * spread) * 100;
      const y = (margin + Math.min(1, Math.max(0, gy + jy)) * spread) * 100;
      pts.push({
        x: Math.min(96, Math.max(4, x)),
        y: Math.min(94, Math.max(6, y)),
      });
    }
  }
  return pts.slice(0, n);
}

function visualDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = (a.x - b.x) * 16;
  const dy = (a.y - b.y) * 9;
  return dx * dx + dy * dy;
}

/** Home on the left (campaign feel). Roads join nearby cells. */
function connectEven(pos: { x: number; y: number }[]): number[][] {
  const n = pos.length;
  let home = 0;
  let bestHome = Infinity;
  for (let i = 0; i < n; i++) {
    // Prefer west edge near mid height — like 始原 on the classic war map.
    const d = pos[i].x * 3 + Math.abs(pos[i].y - 50);
    if (d < bestHome) {
      bestHome = d;
      home = i;
    }
  }
  if (home !== 0) {
    const swap = pos[0];
    pos[0] = pos[home];
    pos[home] = swap;
  }
  const adj: number[][] = Array.from({ length: n }, () => []);
  const seen = new Set<number>([0]);
  while (seen.size < n) {
    let best = Infinity;
    let a = 0;
    let b = 1;
    for (const i of seen) {
      for (let j = 0; j < n; j++) {
        if (seen.has(j)) continue;
        const d = visualDist(pos[i], pos[j]);
        if (d < best) {
          best = d;
          a = i;
          b = j;
        }
      }
    }
    link(adj, a, b);
    seen.add(b);
  }
  for (let i = 0; i < n; i++) {
    const near: { d: number; j: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j) near.push({ d: visualDist(pos[i], pos[j]), j });
    }
    near.sort((p, q) => p.d - q.d);
    const first = near[0];
    const second = near[1];
    if (first && adj[i].length < 3) link(adj, i, first.j);
    if (second && adj[i].length < 3 && second.d < first.d * 2.4) link(adj, i, second.j);
  }
  return adj;
}

function graphDist(adj: number[][], from: number, to: number): number {
  const q = [from];
  const dist = new Array<number>(adj.length).fill(-1);
  dist[from] = 0;
  for (let i = 0; i < q.length; i++) {
    const id = q[i];
    if (id === to) return dist[id];
    for (const nb of adj[id]) {
      if (dist[nb] >= 0) continue;
      dist[nb] = dist[id] + 1;
      q.push(nb);
    }
  }
  return 99;
}

function pickStrongholds(adj: number[][], count: number, rng: () => number): Set<number> {
  const order = Array.from({ length: adj.length - 1 }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const holds: number[] = [];
  for (const id of order) {
    if (holds.length >= count) break;
    if (holds.some((h) => graphDist(adj, id, h) < 2)) continue;
    holds.push(id);
  }
  for (const id of order) {
    if (holds.length >= count) break;
    if (!holds.includes(id)) holds.push(id);
  }
  return new Set(holds);
}

function fodderEnemy(rng: () => number, level: number): { enemy: EnemyUnit[]; hint: ElementType } {
  const slots = [5, 2, 8];
  const enemy: EnemyUnit[] = [];
  for (let i = 0; i < slots.length; i++) {
    const card = FODDER_CARDS[Math.floor(rng() * FODDER_CARDS.length)];
    enemy.push({ cardId: card.id, slot: slots[i], level, leader: i === 0 });
  }
  const hint = HINTS[Math.floor(rng() * HINTS.length)];
  return { enemy, hint };
}

function buildSoloStage(rank: PlayerRank, stage: number): SoloStage {
  const meta = RANK_META[rank];
  const n = meta.cells;
  const rng = mulberry32(stageSeed(rank, Math.max(1, stage)));
  const field = SOLO_FIELDS[(Math.max(1, stage) - 1) % SOLO_FIELDS.length];
  const pos = evenPositions(n, rng, meta.spread);
  const adj = connectEven(pos);
  const holds = pickStrongholds(adj, meta.strongholds, rng);
  const level = 1 + rankIndex(rank);
  const nodes: MapNode[] = [];
  let holdN = 0;
  for (let i = 0; i < n; i++) {
    const id = i === 0 ? `s${stage}-home` : `s${stage}-${i}`;
    const stronghold = holds.has(i);
    const { enemy, hint } = i === 0 ? { enemy: [] as EnemyUnit[], hint: "earth" as ElementType } : fodderEnemy(rng, level);
    const gold = stronghold ? 80 + rankIndex(rank) * 20 : 40 + rankIndex(rank) * 10;
    let name = "本拠";
    let short = "本拠";
    let blurb = "あなたの本拠。隣のマスへ進め。";
    if (stronghold) {
      const k = holdN % HOLD_NAMES.length;
      holdN++;
      name = HOLD_NAMES[k];
      short = HOLD_SHORT[k];
      blurb = `拠点。${STRONGHOLD_WINS}回勝つと占領できる。`;
    } else if (i !== 0) {
      name = `道${i}`;
      short = String(i);
      blurb = "道のマス。一度勝てば通れる。";
    }
    const neighbors = adj[i].map((j) => (j === 0 ? `s${stage}-home` : `s${stage}-${j}`));
    nodes.push({
      id,
      name,
      short,
      blurb,
      x: Math.round(pos[i].x * 10) / 10,
      y: Math.round(pos[i].y * 10) / 10,
      neighbors,
      hint,
      field,
      enemy,
      reward: { gold: i === 0 ? 0 : gold },
      home: i === 0,
      holdNeed: stronghold ? STRONGHOLD_WINS : 1,
    });
  }
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  return { rank, stage, field, nodes, byId, homeId: nodes[0].id };
}

/** 勝利1回分。拠点は holdNeed に達するまで占領しない。 */
export function applyVictory(
  node: MapNode,
  captured: string[],
  holdWins: Record<string, number>,
): {
  captured: string[];
  holdWins: Record<string, number>;
  took: boolean;
  have: number;
  need: number;
} {
  const need = node.holdNeed ?? 1;
  const have = (holdWins[node.id] ?? 0) + 1;
  if (have >= need) {
    const nextWins = { ...holdWins };
    delete nextWins[node.id];
    const nextCap = captured.includes(node.id) ? captured : [...captured, node.id];
    return { captured: nextCap, holdWins: nextWins, took: true, have: need, need };
  }
  return {
    captured,
    holdWins: { ...holdWins, [node.id]: have },
    took: false,
    have,
    need,
  };
}
