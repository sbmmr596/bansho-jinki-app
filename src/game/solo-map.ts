import { FODDER_CARDS } from "./data";
import { RANK_META, rankIndex, type PlayerRank } from "./rank";
import type { ElementType, EnemyUnit, FieldKind, MapNode } from "./types";

/** 拠点は数回勝たないと占領できない。開発中の固定値。 */
export const STRONGHOLD_WINS = 3;

const FIELDS: FieldKind[] = ["grass", "forest", "snow", "waste", "magma"];

export const FIELD_SRC: Record<FieldKind, string> = {
  grass: "/bg/grass.jpg",
  snow: "/bg/snow.jpg",
  magma: "/bg/magma.jpg",
  forest: "/bg/forest.jpg",
  waste: "/bg/field.jpg",
};

export const FIELD_LABEL: Record<FieldKind, string> = {
  grass: "草原",
  snow: "雪原",
  magma: "岩漿",
  forest: "森林",
  waste: "荒野",
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

function buildAdj(n: number, extra: number, rng: () => number): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 1; i < n; i++) {
    let parent = 0;
    let best = Infinity;
    for (let t = 0; t < 5; t++) {
      const c = Math.floor(rng() * i);
      const score = adj[c].length + rng();
      if (score < best) {
        best = score;
        parent = c;
      }
    }
    link(adj, parent, i);
  }
  let added = 0;
  let guard = 0;
  while (added < extra && guard < extra * 30) {
    guard++;
    const a = Math.floor(rng() * n);
    const b = Math.floor(rng() * n);
    if (adj[a].includes(b)) continue;
    link(adj, a, b);
    added++;
  }
  return adj;
}

function layout(adj: number[][], rng: () => number, spread: number): { x: number; y: number }[] {
  const n = adj.length;
  const W = 1000;
  const H = 562;
  const pos = Array.from({ length: n }, () => ({ x: W / 2, y: H / 2 }));
  const parent = new Array<number>(n).fill(-1);
  const kids: number[][] = Array.from({ length: n }, () => []);
  const q = [0];
  const seen = new Set([0]);
  for (let qi = 0; qi < q.length; qi++) {
    const id = q[qi];
    for (const nb of adj[id]) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      parent[nb] = id;
      kids[id].push(nb);
      q.push(nb);
    }
  }
  const radius = Math.max(54, 920 / Math.sqrt(n));
  const place = (id: number, x: number, y: number, angle: number, sweep: number, step: number) => {
    pos[id] = { x, y };
    const ch = kids[id];
    ch.forEach((k, i) => {
      const a = angle - sweep / 2 + (sweep * (i + 0.5)) / ch.length + (rng() - 0.5) * 0.25;
      place(k, x + Math.cos(a) * step, y + Math.sin(a) * step, a, Math.max(0.5, sweep / ch.length) * 1.35, step * 0.9);
    });
  };
  place(0, W / 2, H / 2, -Math.PI / 2, Math.PI * 1.7, radius);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pos) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const sx = (W * spread * 0.9) / Math.max(1, maxX - minX);
  const sy = (H * spread * 0.9) / Math.max(1, maxY - minY);
  const s = Math.min(sx, sy);
  for (const p of pos) {
    p.x = W / 2 + (p.x - cx) * s;
    p.y = H / 2 + (p.y - cy) * s;
  }
  // Keep circles apart after the rank scales the field down.
  const min = 38;
  for (let iter = 0; iter < 80; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const push = (min - d) / 2;
        dx /= d;
        dy /= d;
        pos[i].x -= dx * push;
        pos[i].y -= dy * push;
        pos[j].x += dx * push;
        pos[j].y += dy * push;
      }
    }
    for (const p of pos) {
      p.x = Math.min(W * 0.96, Math.max(W * 0.04, p.x));
      p.y = Math.min(H * 0.94, Math.max(H * 0.06, p.y));
    }
  }
  return pos.map((p) => ({
    x: Math.round((p.x / W) * 1000) / 10,
    y: Math.round((p.y / H) * 1000) / 10,
  }));
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
  const field = FIELDS[(Math.max(1, stage) - 1) % FIELDS.length];
  const adj = buildAdj(n, Math.max(2, Math.round(n / 12)), rng);
  const pos = layout(adj, rng, meta.spread);
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
