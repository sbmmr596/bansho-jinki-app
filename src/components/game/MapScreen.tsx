import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
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

  /** Captured / home / adjacent uncaptured (fog for plain cells). */
  const isOpenVisible = (id: string) => {
    const n = byId[id];
    if (!n) return false;
    if (n.home || captured.includes(id)) return true;
    return canAttack(id);
  };
  /** 拠点は隣接していなくても表示だけはする（攻められるのは隣接時のみ）。 */
  const isLockedHold = (id: string) => {
    const n = byId[id];
    return !!n && (n.holdNeed ?? 1) > 1 && !isOpenVisible(id);
  };
  const isVisible = (id: string) => isOpenVisible(id) || isLockedHold(id);

  const viewRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const scrollable = map.fieldW > 1 || map.fieldH > 1;

  // Start centred on the home base.
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const home = map.byId[map.homeId];
    el.scrollLeft = (home.x / 100) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = (home.y / 100) * el.scrollHeight - el.clientHeight / 2;
  }, [map]);

  /** Screen delta → stage-local delta (stage may be scaled and rotated 90°). */
  const toLocal = (dx: number, dy: number) => {
    const stageEl = viewRef.current?.closest(".game-stage") as HTMLElement | null;
    const scale = stageEl
      ? parseFloat(getComputedStyle(stageEl).getPropertyValue("--stage-scale")) || 1
      : 1;
    if (stageEl?.classList.contains("is-rotated")) return { x: dy / scale, y: -dx / scale };
    return { x: dx / scale, y: dy / scale };
  };

  const onPanDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    if (!el || !scrollable || (e.pointerType === "mouse" && e.button !== 0)) return;
    suppressClick.current = false;
    pan.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
  };
  const onPanMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    const p = pan.current;
    if (!el || !p || p.id !== e.pointerId) return;
    const d = toLocal(e.clientX - p.x, e.clientY - p.y);
    if (!p.moved && Math.hypot(d.x, d.y) < 8) return;
    if (!p.moved) {
      p.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = p.left - d.x;
    el.scrollTop = p.top - d.y;
  };
  const onPanUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p || p.id !== e.pointerId) return;
    if (p.moved) suppressClick.current = true;
    pan.current = null;
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
          ref={viewRef}
          className="relative min-h-0 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg hairline"
          style={{ background: FIELD_BOARD[map.field] }}
          onPointerDown={onPanDown}
          onPointerMove={onPanMove}
          onPointerUp={onPanUp}
          onPointerCancel={onPanUp}
          onClickCapture={(e) => {
            if (!suppressClick.current) return;
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheel={(e) => {
            const el = viewRef.current;
            if (!el || !scrollable) return;
            el.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX;
            el.scrollTop += e.shiftKey ? 0 : e.deltaY;
          }}
        >
          {/* Whole field; terrain art is a seamless tile repeated per map-frame screen. */}
          <div
            className="absolute left-0 top-0"
            style={{
              width: `${map.fieldW * 100}%`,
              height: `${map.fieldH * 100}%`,
              backgroundImage: `url(${FIELD_SRC[map.field]})`,
              backgroundSize: `${100 / map.fieldW}% ${100 / map.fieldH}%`,
              backgroundRepeat: "repeat",
            }}
          >
            <div className="absolute inset-0 bg-black/15" />
            {/* Roads between cells: dark edge + sand core (gold when both ends are yours). */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {(["edge", "core"] as const).map((layer) => (
                <g key={layer}>
                  {visible.flatMap((n) =>
                    n.neighbors
                      .filter(
                        (nb) => nb > n.id && isOpenVisible(n.id) && isOpenVisible(nb) && byId[nb],
                      )
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
              const locked = isLockedHold(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-label={locked ? `${n.name}（未到達）` : n.name}
                  aria-disabled={locked || undefined}
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
                    locked && "cursor-default",
                  )}
                  style={{ left: `${n.x}%`, top: `${n.y}%`, zIndex: base ? 3 : 2 }}
                >
                  {n.home ? (
                    <HomeBadge />
                  ) : stronghold ? (
                    <HoldBadge
                      id={n.id}
                      kind={n.short}
                      state={mine ? "mine" : open ? "open" : "locked"}
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
          {scrollable ? (
            <span className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-black/55 px-2 py-0.5 text-xs text-fg/90">
              ドラッグで移動
            </span>
          ) : null}
        </div>
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
          <p className="text-xs text-muted">
            {FIELD_LABEL[map.field]}・獲得 {capturePct}%（{held}/{map.nodes.length}）
          </p>
          <p className="text-xs text-muted">
            接する未占領を選べ。出撃は闘気1。拠点は3勝で占領。錠の拠点はまだ届かない。
          </p>
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
