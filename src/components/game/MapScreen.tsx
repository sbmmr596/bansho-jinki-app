import { useEffect } from "react";
import { SPIRIT_MAX } from "@/game/arena";
import { COUNTER_OF, HOME_ID, NODE_BY_ID, NODES, TYPE_LABEL } from "@/game/data";
import { useGame } from "@/game/store";
import { GoldChip, Shell, SpiritChip, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

export function MapScreen() {
  const captured = useGame((s) => s.captured);
  const gold = useGame((s) => s.gold);
  const spirit = useGame((s) => s.spirit);
  const tickSpirit = useGame((s) => s.tickSpirit);
  const openScout = useGame((s) => s.openScout);
  const won = captured.includes("capital");

  useEffect(() => {
    tickSpirit();
    const id = window.setInterval(() => tickSpirit(), 15_000);
    return () => window.clearInterval(id);
  }, [tickSpirit]);

  const canAttack = (id: string) => {
    const n = NODE_BY_ID[id];
    if (!n || n.home || captured.includes(id)) return false;
    return n.neighbors.some((nb) => captured.includes(nb));
  };

  /** Captured + home + adjacent uncaptured only (fog of war). */
  const isVisible = (id: string) => {
    const n = NODE_BY_ID[id];
    if (!n) return false;
    if (n.home || captured.includes(id)) return true;
    return canAttack(id);
  };

  const visible = NODES.filter((n) => isVisible(n.id));
  const targets = NODES.filter((n) => canAttack(n.id));
  const held = captured.filter((id) => NODE_BY_ID[id]).length;
  const capturePct = Math.round((held / NODES.length) * 100);

  return (
    <Shell
      title="神域大戦"
      extra={
        <span className="inline-flex items-center gap-2">
          <span className="text-sm tabular text-brass">獲得 {capturePct}%</span>
          <SpiritChip spirit={spirit} max={SPIRIT_MAX} />
          <GoldChip gold={gold} />
        </span>
      }
      nav="map"
      wide
    >
      <div className="flex h-full min-h-0 gap-3">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden [container-type:size]">
          {/* 背景は拠点と同じ11領地。枠は絵と同じ16:9で、% が領地の中心に合う。 */}
          <div className="absolute top-1/2 left-1/2 aspect-[16/9] w-[min(100cqw,calc(100cqh*16/9))] -translate-x-1/2 -translate-y-1/2">
            <img
              src="/bg/map.jpg"
              alt=""
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full"
            />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {visible.flatMap((n) =>
                n.neighbors
                  .filter((nb) => nb > n.id && isVisible(nb) && NODE_BY_ID[nb])
                  .map((nb) => {
                    const o = NODE_BY_ID[nb]!;
                    const mine = captured.includes(n.id) && captured.includes(o.id);
                    return (
                      <line
                        key={`${n.id}-${nb}`}
                        x1={100 - n.x}
                        y1={n.y}
                        x2={100 - o.x}
                        y2={o.y}
                        stroke={mine ? "var(--color-brass)" : "var(--color-border)"}
                        strokeWidth="0.6"
                      />
                    );
                  }),
              )}
            </svg>
            {visible.map((n) => {
              const mine = captured.includes(n.id);
              const open = canAttack(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.home) return;
                    if (open) openScout(n.id);
                  }}
                  className={cn(
                    "absolute flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2.5 text-[14px] font-medium",
                    n.home && "bg-brass text-bg",
                    mine && !n.home && "bg-ok text-bg",
                    open && "bg-crimson text-fg ring-2 ring-brass",
                  )}
                  style={{ left: `${100 - n.x}%`, top: `${n.y}%` }}
                >
                  {n.short}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
          <p className="text-xs text-muted">
            獲得陣地 {capturePct}%（{held}/{NODES.length}）
          </p>
          <p className="text-xs text-muted">
            {won ? "帝都を制した。" : "接する未占領を選べ。出撃は闘気1。"}
          </p>
          {targets.map((n) => (
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
                  {COUNTER_OF[n.hint].map((t) => TYPE_LABEL[t]).join("・")}が刺さる
                </p>
              </div>
            </button>
          ))}
          {!targets.length && !won ? (
            <p className="text-[14px] text-faint">本拠は {NODE_BY_ID[HOME_ID]?.short ?? "始原"}</p>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
