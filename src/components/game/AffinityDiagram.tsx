import { TYPE_HINT, TYPE_LABEL } from "@/game/data";
import type { ElementType } from "@/game/types";
import { TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

const TRI: ElementType[] = ["power", "skill", "magic"];
const EXTRA: ElementType[] = ["void", "heaven", "earth"];

/** Visual affinity chart for 遊び方 / battle toggle. */
export function AffinityDiagram({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("text-sm text-muted", compact && "text-xs")}>
      <div
        className={cn(
          "relative mx-auto grid place-items-center",
          compact ? "h-36 w-full max-w-xs" : "h-44 w-full max-w-sm",
        )}
      >
        {/* triangle nodes */}
        <Node type="power" className="absolute left-1/2 top-1 -translate-x-1/2" />
        <Node type="skill" className="absolute bottom-2 left-2" />
        <Node type="magic" className="absolute bottom-2 right-2" />
        {/* arrows as SVG */}
        <svg
          className="pointer-events-none absolute inset-2 text-brass/80"
          viewBox="0 0 200 160"
          fill="none"
          aria-hidden
        >
          <defs>
            <marker id="aff-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>
          {/* power -> skill */}
          <path d="M95 28 L55 118" stroke="currentColor" strokeWidth="2" markerEnd="url(#aff-arrow)" />
          {/* skill -> magic */}
          <path d="M70 130 L130 130" stroke="currentColor" strokeWidth="2" markerEnd="url(#aff-arrow)" />
          {/* magic -> power */}
          <path d="M145 118 L105 28" stroke="currentColor" strokeWidth="2" markerEnd="url(#aff-arrow)" />
        </svg>
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] tracking-wide text-faint">
          有利方向
        </p>
      </div>
      <p className={cn("mb-2 text-center leading-relaxed", compact ? "mt-1" : "mt-2")}>
        力 → 技 → 魔 → 力（有利は致命 1.5／やや有利は強 1.2／不利は防 0.5）
      </p>
      <ul className={cn("space-y-1", compact && "space-y-0.5")}>
        {[...TRI, ...EXTRA].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <TypeBadge type={t} />
            <span>
              <span className="text-fg">{TYPE_LABEL[t]}</span>：{TYPE_HINT[t]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Node({ type, className }: { type: ElementType; className?: string }) {
  return (
    <div className={cn("z-10 flex flex-col items-center gap-1", className)}>
      <TypeBadge type={type} />
      <span className="text-[10px] text-fg">{TYPE_LABEL[type]}</span>
    </div>
  );
}
