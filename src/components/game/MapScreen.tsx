import { useEffect } from "react";
import { SPIRIT_MAX } from "@/game/arena";
import { COUNTER_OF, TYPE_LABEL } from "@/game/data";
import { rankForXp, rankLabel } from "@/game/rank";
import { FIELD_BOARD, FIELD_LABEL, FIELD_SRC, soloStage } from "@/game/solo-map";
import { useGame } from "@/game/store";
import { GoldChip, Shell, SpiritChip, TypeBadge } from "./pieces";
import { HoldBadge, HomeBadge } from "./map-marks";
import { cn } from "@/lib/utils";

export function MapScreen() {
  const captured = useGame((s) => s.captured);
  const holdWins = useGame((s) => s.holdWins);
  const stage = useGame((s) => s.stage);
  const xp = useGame((s) => s.xp);
  const gold = useGame((s) => s.gold);
  const spirit = useGame((s) => s.spirit);
  const tickSpirit = useGame((s) => s.tickSpirit);
  const openScout = useGame((s) => s.openScout);
  const rank = rankForXp(xp);
  const map = soloStage(rank, stage);
  const byId = map.byId;

  useEffect(() => {
    tickSpirit();
    const id = window.setInterval(() => tickSpirit(), 15_000);
    return () => window.clearInterval(id);
  }, [tickSpirit]);

  const canAttack = (id: string) => {
    const n = byId[id];
    if (!n || n.home || captured.includes(id)) return false;
    return n.neighbors.some((nb) => captured.includes(nb));
  };

  /** Captured / home / adjacent uncaptured only. */
  const isVisible = (id: string) => {
    const n = byId[id];
    if (!n) return false;
    if (n.home || captured.includes(id)) return true;
    return canAttack(id);
  };

  const visible = map.nodes.filter((n) => isVisible(n.id));
  const targets = map.nodes.filter((n) => canAttack(n.id));
  const held = map.nodes.filter((n) => captured.includes(n.id)).length;
  const capturePct = Math.round((held / map.nodes.length) * 100);

  return (
    <Shell
      title="冒険"
      extra={
        <span className="inline-flex items-center gap-2">
          <span className="text-sm text-brass">
            {rankLabel(rank)}・第{stage}段
          </span>
          <span className="text-sm tabular text-brass">獲得 {capturePct}%</span>
          <SpiritChip spirit={spirit} max={SPIRIT_MAX} />
          <GoldChip gold={gold} />
        </span>
      }
      nav="map"
      wide
    >
      <div className="flex h-full min-h-0 gap-3">
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg hairline"
          style={{ background: FIELD_BOARD[map.field] }}
        >
          <img src={FIELD_SRC[map.field]} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/15" />
          {/* Roads between cells: dark edge + sand core (gold when both ends are yours). */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(["edge", "core"] as const).map((layer) => (
              <g key={layer}>
                {visible.flatMap((n) =>
                  n.neighbors
                    .filter((nb) => nb > n.id && isVisible(nb) && byId[nb])
                    .map((nb) => {
                      const o = byId[nb]!;
                      const mine = captured.includes(n.id) && captured.includes(o.id);
                      return (
                        <line
                          key={`${layer}-${n.id}-${nb}`}
                          x1={n.x}
                          y1={n.y}
                          x2={o.x}
                          y2={o.y}
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          stroke={layer === "edge" ? "#140a06" : mine ? "#ffd24a" : "#f4e2b4"}
                          strokeWidth={layer === "edge" ? 9 : 4.5}
                          strokeDasharray={layer === "core" && !mine ? "9 6" : undefined}
                        />
                      );
                    }),
                )}
              </g>
            ))}
          </svg>
          {visible.map((n) => {
            const mine = captured.includes(n.id);
            const open = canAttack(n.id);
            const stronghold = (n.holdNeed ?? 1) > 1;
            const progress = holdWins[n.id] ?? 0;
            const base = n.home || stronghold;
            return (
              <button
                key={n.id}
                type="button"
                aria-label={n.name}
                onClick={() => {
                  if (n.home || !open) return;
                  openScout(n.id);
                }}
                className={cn(
                  "absolute flex -translate-x-1/2 items-center justify-center",
                  base
                    ? n.home
                      ? "h-[88px] w-[72px] -translate-y-[42%]"
                      : "h-[84px] w-16 -translate-y-[42%]"
                    : "h-11 w-11 -translate-y-1/2 rounded-full border-[3px] border-[#140a06] shadow-[0_3px_0_rgba(0,0,0,0.45)]",
                  !base && !mine && !open && "bg-ink/85",
                  !base && mine && "bg-[#1fb06a] ring-2 ring-inset ring-[#bff5d6]",
                  !base && open && "bg-[#d62a3c] ring-2 ring-inset ring-[#ffd86a]",
                  open && base && "drop-shadow-[0_0_6px_rgba(255,90,90,0.9)]",
                )}
                style={{ left: `${n.x}%`, top: `${n.y}%`, zIndex: base ? 3 : 2 }}
              >
                {n.home ? (
                  <HomeBadge />
                ) : stronghold ? (
                  <HoldBadge
                    id={n.id}
                    kind={n.short}
                    state={mine ? "mine" : open ? "open" : "idle"}
                    wins={progress}
                    need={n.holdNeed ?? 1}
                  />
                ) : null}
                {stronghold && progress > 0 && !mine ? (
                  <span className="sr-only">
                    {progress}/{n.holdNeed}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
          <p className="text-xs text-muted">
            {FIELD_LABEL[map.field]}・獲得 {capturePct}%（{held}/{map.nodes.length}）
          </p>
          <p className="text-xs text-muted">接する未占領を選べ。出撃は闘気1。拠点は3勝で占領。</p>
          {targets.map((n) => {
            const progress = holdWins[n.id] ?? 0;
            const need = n.holdNeed ?? 1;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openScout(n.id)}
                className="flex items-center gap-2 rounded-lg bg-surface/90 p-2 text-left hairline"
              >
                <TypeBadge type={n.hint} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{n.name}</p>
                  <p className="truncate text-[14px] text-muted">
                    {need > 1
                      ? `拠点 ${progress}/${need}`
                      : COUNTER_OF[n.hint].map((t) => TYPE_LABEL[t]).join("・") + "が刺さる"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
