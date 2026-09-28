/**
 * 冒険マップのマス表示。
 * - 本拠: 金の大きな城紋（「本拠」リボン付き）
 * - 拠点: 盾形の砦紋。状態で色が変わる（攻略可=紅 / 占領済=翠 / 未到達=灰＋錠）。下に勝利数の菱形。
 *   拠点は隣接していなくても表示する（未到達は灰色で錠前付き、押せない）。
 * - 道: 小さな丸（MapScreen 側）
 * 神羅万象風に、太い黒縁・硬い陰・宝石色。
 */

const OUTLINE = "#140a06";

const PATHS: Record<string, string> = {
  関: "M4 20V8h4v4h8V8h4v12H4Zm6-8h4v8h-4v-8Z",
  砦: "M3 9h3V5h3v4h2V5h3v4h2V5h3v4h2v12H3V9Z",
  塔: "M10 3h4v3h2v15H8V6h2V3Zm2 8h-1v3h1v-3Z",
  社: "M2 10h20v2H2v-2Zm3 2h2v8H5v-8Zm12 0h2v8h-2v-8ZM4 8l8-5 8 5H4Z",
  陣: "M5 21V4h2v7h4V7h2v14h-2v-6H7v6H5Z",
  城: "M3 10h3V6h3v4h2V6h2v4h2V6h3v4h3v11H3V10Z",
  港: "M11 3h2v6h4a5 5 0 1 1-10 0h4V3ZM4 18h16v2H4v-2Z",
  嶺: "M2 19 9 6l3 5 2-3 8 11H2Z",
  丘: "M2 18c3-6 6-8 10-8s7 2 10 8H2Z",
  原: "M3 16h18v2H3v-2Zm1-4h16v2H4v-2Zm2-4h12v2H6V8Z",
};

export type HoldState = "open" | "mine" | "locked";

const HOLD_FILL: Record<HoldState, { hi: string; lo: string; rim: string; icon: string }> = {
  open: { hi: "#ff4a5a", lo: "#9a0f24", rim: "#ffd86a", icon: "#fff6e0" },
  mine: { hi: "#34e08a", lo: "#0b7a44", rim: "#ffe8a0", icon: "#f4fff6" },
  locked: { hi: "#8a8494", lo: "#4a4452", rim: "#6e6878", icon: "#bdb6c4" },
};

const SHIELD = "M32 3 L59 11 V35 C59 52 47 62 32 69 C17 62 5 52 5 35 V11 Z";

/** Strongholds: shield crest + fort icon + win pips. Size is set by the parent box. */
export function HoldBadge({
  kind,
  state,
  wins,
  need,
  id,
}: {
  kind: string;
  state: HoldState;
  wins: number;
  need: number;
  id: string;
}) {
  const f = HOLD_FILL[state];
  const d = PATHS[kind] ?? PATHS["陣"];
  const gid = `hold-${id}`;
  const shown = state === "mine" ? need : Math.min(wins, need);
  const pipW = 13;
  const pipsX = 32 - ((need - 1) * pipW) / 2;
  const locked = state === "locked";
  return (
    <svg
      viewBox="0 0 64 84"
      className="h-full w-full overflow-visible"
      style={locked ? { opacity: 0.88 } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={f.hi} />
          <stop offset="0.55" stopColor={f.hi} />
          <stop offset="0.56" stopColor={f.lo} />
          <stop offset="1" stopColor={f.lo} />
        </linearGradient>
      </defs>
      <ellipse cx="34" cy="70" rx="22" ry="5" fill="rgba(0,0,0,0.45)" />
      <path
        d={SHIELD}
        fill={`url(#${gid})`}
        stroke={OUTLINE}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M32 9 L53 15.5 V35 C53 48.5 44 56.5 32 62.5 C20 56.5 11 48.5 11 35 V15.5 Z"
        fill="none"
        stroke={f.rim}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* fort icon with its own dark edge */}
      <g transform="translate(14 12) scale(1.5)">
        <path d={d} fill={OUTLINE} stroke={OUTLINE} strokeWidth="2.6" strokeLinejoin="round" />
        <path d={d} fill={f.icon} />
      </g>
      {locked ? (
        /* padlock: not reachable yet */
        <g transform="translate(40 40)">
          <path d="M4 9 V5.5 a6 6 0 0 1 12 0 V9" fill="none" stroke={OUTLINE} strokeWidth="6" />
          <path d="M4 9 V5.5 a6 6 0 0 1 12 0 V9" fill="none" stroke="#e8e0c8" strokeWidth="2.6" />
          <rect
            x="0"
            y="8.5"
            width="20"
            height="15"
            rx="2.5"
            fill="#e8c24a"
            stroke={OUTLINE}
            strokeWidth="3"
          />
          <rect x="8.6" y="12.5" width="2.8" height="6" rx="1.2" fill={OUTLINE} />
        </g>
      ) : null}
      {need > 1 && !locked
        ? Array.from({ length: need }, (_, i) => {
            const cx = pipsX + i * pipW;
            const on = i < shown;
            return (
              <path
                key={i}
                d={`M${cx} 70.5 l6 6.5 l-6 6.5 l-6 -6.5 Z`}
                fill={on ? "#ffd84a" : "#2a2230"}
                stroke={OUTLINE}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            );
          })
        : null}
    </svg>
  );
}

/** Home base: big gold castle crest with a 本拠 ribbon. */
export function HomeBadge() {
  return (
    <svg viewBox="0 0 72 88" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="home-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff09a" />
          <stop offset="0.5" stopColor="#ffc93a" />
          <stop offset="0.51" stopColor="#c47a10" />
          <stop offset="1" stopColor="#8a4a06" />
        </linearGradient>
      </defs>
      <ellipse cx="38" cy="74" rx="26" ry="6" fill="rgba(0,0,0,0.45)" />
      <path
        d="M36 3 L66 12 V38 C66 57 53 67 36 74 C19 67 6 57 6 38 V12 Z"
        fill="url(#home-gold)"
        stroke={OUTLINE}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M36 10 L59 17 V38 C59 52 49 60 36 66 C23 60 13 52 13 38 V17 Z"
        fill="#7a1420"
        stroke={OUTLINE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 天守（castle keep） */}
      <g stroke={OUTLINE} strokeWidth="2.4" strokeLinejoin="round">
        <path d="M22 26 L36 17 L50 26 Z" fill="#2b3b66" />
        <rect x="27" y="26" width="18" height="8" fill="#fff6e0" />
        <path d="M19 38 L36 29 L53 38 Z" fill="#2b3b66" />
        <rect x="23" y="38" width="26" height="15" fill="#fff6e0" />
        <rect x="32.5" y="44" width="7" height="9" fill="#3a2410" />
        <path d="M17 58 H55 L52 53 H20 Z" fill="#9aa0a8" />
      </g>
      <g>
        <path
          d="M8 70 H64 L60 77 L64 84 H8 L12 77 Z"
          fill="#b01828"
          stroke={OUTLINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text
          x="36"
          y="81.5"
          textAnchor="middle"
          fontSize="12"
          fontWeight="900"
          fill="#fff6e0"
          stroke={OUTLINE}
          strokeWidth="2.4"
          paintOrder="stroke"
          letterSpacing="2"
        >
          本拠
        </text>
      </g>
    </svg>
  );
}
