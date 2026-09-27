import { COUNTER_OF, TYPE_LABEL } from "@/game/data";
import { rankForStage, rankLabel } from "@/game/rank";
import { FIELD_BOARD, FIELD_LABEL, soloStage } from "@/game/solo-map";
import { useGame } from "@/game/store";
import { GoldChip, Shell, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

export function MapScreen() {
  const captured = useGame((s) => s.captured);
  const holdWins = useGame((s) => s.holdWins);
  const stage = useGame((s) => s.stage);
  const gold = useGame((s) => s.gold);
  const openScout = useGame((s) => s.openScout);
  const rank = rankForStage(stage);
  const map = soloStage(rank, stage);
  const byId = map.byId;

  const canAttack = (id: string) => {
    const n = byId[id];
    if (!n || n.home || captured.includes(id)) return false;
    return n.neighbors.some((nb) => captured.includes(nb));
  };

  const targets = map.nodes.filter((n) => canAttack(n.id));
  const held = map.nodes.filter((n) => captured.includes(n.id)).length;

  return (
    <Shell
      title="冒険"
      extra={
        <span className="inline-flex items-center gap-2">
          <span className="text-sm text-brass">
            {rankLabel(rank)}・第{stage}段
          </span>
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
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {map.nodes.flatMap((n) =>
              n.neighbors
                .filter((nb) => nb > n.id)
                .map((nb) => {
                  const o = byId[nb];
                  if (!o) return null;
                  const mine = captured.includes(n.id) && captured.includes(o.id);
                  return (
                    <line
                      key={n.id + nb}
                      x1={n.x}
                      y1={n.y}
                      x2={o.x}
                      y2={o.y}
                      stroke={mine ? "var(--color-brass)" : "var(--color-border)"}
                      strokeWidth="0.35"
                    />
                  );
                }),
            )}
          </svg>
          {map.nodes.map((n) => {
            const mine = captured.includes(n.id);
            const open = canAttack(n.id);
            const stronghold = (n.holdNeed ?? 1) > 1;
            const progress = holdWins[n.id] ?? 0;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (n.home || !open) return;
                  openScout(n.id);
                }}
                className={cn(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-medium",
                  stronghold || n.home ? "h-10 min-w-10 px-1 text-[13px]" : "h-7 w-7 text-[11px]",
                  n.home && "bg-brass text-bg",
                  mine && !n.home && "bg-ok text-bg",
                  open && "bg-crimson text-fg ring-2 ring-brass",
                  !mine && !open && !n.home && "bg-ink/85 text-faint hairline",
                )}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                {n.home ? "本" : stronghold ? n.short : n.short}
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
            {FIELD_LABEL[map.field]}　{held}/{map.nodes.length}
          </p>
          <p className="text-xs text-muted">接する未占領を選べ。拠点は3勝で占領。</p>
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
                    {need > 1 ? `拠点 ${progress}/${need}` : COUNTER_OF[n.hint].map((t) => TYPE_LABEL[t]).join("・") + "が刺さる"}
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
