import { COUNTER_OF, NODE_BY_ID, NODES, TYPE_LABEL } from "@/game/data";
import { useGame } from "@/game/store";
import { GoldChip, Shell, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

export function MapScreen() {
  const captured = useGame((s) => s.captured);
  const gold = useGame((s) => s.gold);
  const openScout = useGame((s) => s.openScout);
  const won = captured.includes("capital");

  const canAttack = (id: string) => {
    const n = NODE_BY_ID[id];
    if (!n || n.home || captured.includes(id)) return false;
    return n.neighbors.some((nb) => captured.includes(nb));
  };

  const targets = NODES.filter((n) => canAttack(n.id));

  return (
    <Shell title="神域大戦" extra={<GoldChip gold={gold} />} nav="map" wide>
      <div className="flex h-full min-h-0 gap-3">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden [container-type:size]">
          {/* /bg/map.jpg と同じ 16:9。はみ出し切り抜きをやめ、拠点の % を絵の上に乗せる。 */}
          <div className="absolute top-1/2 left-1/2 aspect-[16/9] w-[min(100cqw,calc(100cqh*16/9))] -translate-x-1/2 -translate-y-1/2">
          <img
            src="/bg/map.jpg"
            alt=""
            crossOrigin="anonymous"
            className="absolute inset-0 h-full w-full opacity-90"
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {NODES.flatMap((n) =>
              n.neighbors
                .filter((nb) => nb > n.id)
                .map((nb) => {
                  const o = NODE_BY_ID[nb];
                  if (!o) return null;
                  const mine = captured.includes(n.id) && captured.includes(o.id);
                  return (
                    <line
                      key={n.id + nb}
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
          {NODES.map((n) => {
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
                  !mine && !open && !n.home && "bg-ink/80 text-faint hairline",
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
            {won ? "帝都を制した。" : "接する未占領を選べ。"}
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
        </div>
      </div>
    </Shell>
  );
}
