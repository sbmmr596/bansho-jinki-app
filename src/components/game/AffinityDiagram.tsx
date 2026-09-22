import { TYPE_LABEL } from "@/game/data";
import type { ElementType } from "@/game/types";
import { TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

const RING: Record<ElementType, string> = {
  power: "ring-type-power/80",
  skill: "ring-type-skill/80",
  magic: "ring-type-magic/80",
  void: "ring-type-void/80",
  heaven: "ring-type-heaven/80",
  earth: "ring-type-earth/80",
};

/** Compact affinity chart inspired by classic triangle + side relations diagrams. */
export function AffinityDiagram({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("w-full", compact ? "max-w-md" : "max-w-lg")}>
      <div className={cn("flex items-stretch gap-2", compact ? "gap-1.5" : "gap-3")}>
        {/* Triangle cycle */}
        <div
          className={cn(
            "relative shrink-0 rounded-lg bg-raised/50 hairline",
            compact ? "h-[9.5rem] w-[9.5rem]" : "h-44 w-44",
          )}
        >
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 160" aria-hidden>
            <defs>
              <marker id="a1" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0 0 L5 2.5 L0 5 Z" className="fill-type-power" />
              </marker>
              <marker id="a2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0 0 L5 2.5 L0 5 Z" className="fill-type-skill" />
              </marker>
              <marker id="a3" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0 0 L5 2.5 L0 5 Z" className="fill-type-magic" />
              </marker>
            </defs>
            {/* 力 → 技 */}
            <path d="M78 34 L48 112" stroke="currentColor" className="text-type-power" strokeWidth="2.5" markerEnd="url(#a1)" fill="none" />
            {/* 技 → 魔 */}
            <path d="M58 122 L102 122" stroke="currentColor" className="text-type-skill" strokeWidth="2.5" markerEnd="url(#a2)" fill="none" />
            {/* 魔 → 力 */}
            <path d="M112 112 L82 34" stroke="currentColor" className="text-type-magic" strokeWidth="2.5" markerEnd="url(#a3)" fill="none" />
          </svg>
          <Chip type="power" className="absolute left-1/2 top-1 -translate-x-1/2" />
          <Chip type="skill" className="absolute bottom-1 left-1" />
          <Chip type="magic" className="absolute bottom-1 right-1" />
        </div>

        {/* Side relations + multipliers */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          <div className="rounded-lg bg-raised/50 p-1.5 hairline">
            <p className="mb-1 text-center text-[11px] tracking-wide text-faint">無・天・地</p>
            <div className="flex items-center justify-center gap-1">
              <Chip type="void" />
              <span className="text-[11px] text-brass">⇔</span>
              <div className="flex flex-col items-center gap-0.5">
                <Chip type="heaven" />
                <Chip type="earth" />
              </div>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              無は天・地に強い／天は力技魔にやや強い／地は天に強い
            </p>
          </div>
          <div className="rounded-md bg-ink/80 px-2 py-1 text-[11px] leading-snug text-muted hairline">
            <p>
              <span className="text-crimson">有利</span> 致命 1.5　
              <span className="text-brass">やや有利</span> 強 1.2　
              <span className="text-faint">不利</span> 防 0.5
            </p>
          </div>
          <div className="grid grid-cols-3 gap-0.5 text-[10px] leading-tight text-muted">
            <Tag type="power" text="＞技　＜魔天" />
            <Tag type="skill" text="＞魔　＜力天" />
            <Tag type="magic" text="＞力　＜技天" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ type, className }: { type: ElementType; className?: string }) {
  return (
    <div className={cn("z-10 flex flex-col items-center", className)}>
      <TypeBadge type={type} className={cn("h-6 min-w-6 rounded-full ring-1", RING[type])} />
      <span className="mt-0.5 text-[11px] text-fg">{TYPE_LABEL[type]}</span>
    </div>
  );
}

function Tag({ type, text }: { type: ElementType; text: string }) {
  return (
    <div className="rounded bg-surface/80 px-1 py-0.5 hairline">
      <span className="text-fg">{TYPE_LABEL[type]}</span>
      <span className="ml-0.5">{text}</span>
    </div>
  );
}
