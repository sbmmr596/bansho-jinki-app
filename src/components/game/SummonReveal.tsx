import { useEffect, useMemo, useRef, useState } from "react";
import { CARD_BY_ID } from "@/game/data";
import { sfx } from "@/game/audio";
import type { Rarity } from "@/game/types";
import { cn } from "@/lib/utils";
import { CardFace } from "./pieces";

export type SummonPhase = "idle" | "charge" | "crack" | "blackout" | "reveal";

type LastSummon = { cardId: string; isNew: boolean; leveled: boolean };

/** Rough totals: N ~0.9s, R ~1.2s, SR ~1.6s, UR ~2.2s (incl. settle before unlock) */
const TIMING: Record<Rarity, { charge: number; crack: number; blackout: number; settle: number }> = {
  N: { charge: 300, crack: 400, blackout: 0, settle: 200 },
  R: { charge: 350, crack: 500, blackout: 0, settle: 350 },
  SR: { charge: 380, crack: 580, blackout: 0, settle: 640 },
  UR: { charge: 400, crack: 600, blackout: 280, settle: 920 },
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SealPlaque({ phase, rarity }: { phase: SummonPhase; rarity: Rarity | null }) {
  const r = (rarity ?? "N").toLowerCase();
  return (
    <div
      className={cn(
        "summon-seal relative flex h-[180px] w-[120px] items-center justify-center overflow-hidden rounded-md",
        phase === "charge" && "summon-seal--charge",
        (phase === "crack" || phase === "blackout") && "summon-seal--crack",
        rarity && `summon-seal--${r}`,
      )}
      aria-hidden
    >
      <div className="summon-seal__ink" />
      <div className="summon-seal__crest">
        <svg viewBox="0 0 80 80" className="h-[72%] w-[72%]" aria-hidden>
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
          <circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          <path
            d="M40 10 L46 28 L64 28 L50 40 L55 58 L40 48 L25 58 L30 40 L16 28 L34 28 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            opacity="0.65"
          />
          <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
      <span className="summon-seal__glyph font-display">召</span>
      {(phase === "crack" || phase === "blackout") && (
        <>
          <span className="summon-crack summon-crack--a" />
          <span className="summon-crack summon-crack--b" />
          <span className="summon-crack summon-crack--c" />
          <span className="summon-crack__glow" />
        </>
      )}
    </div>
  );
}

export function SummonReveal({
  last,
  active,
  onComplete,
}: {
  last: LastSummon | null;
  active: boolean;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<SummonPhase>(active ? "charge" : "idle");
  const timers = useRef<number[]>([]);
  const doneRef = useRef(false);
  const card = last ? CARD_BY_ID[last.cardId] : null;
  const rarity = card?.rarity ?? null;

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => {
    if (!active || !last || !card) return;
    clearTimers();
    doneRef.current = false;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setPhase("idle");
      onComplete();
    };

    if (prefersReducedMotion()) {
      setPhase("reveal");
      sfx("heal");
      const t = window.setTimeout(finish, 280);
      timers.current = [t];
      return () => clearTimers();
    }

    const t = TIMING[card.rarity];
    setPhase("charge");

    const ids: number[] = [];
    ids.push(window.setTimeout(() => setPhase("crack"), t.charge));
    let nextAt = t.charge + t.crack;

    if (t.blackout > 0) {
      ids.push(window.setTimeout(() => setPhase("blackout"), nextAt));
      nextAt += t.blackout;
    }

    ids.push(
      window.setTimeout(() => {
        setPhase("reveal");
        sfx("heal");
      }, nextAt),
    );

    ids.push(window.setTimeout(finish, nextAt + t.settle));
    timers.current = ids;
    return () => clearTimers();
  }, [active, last, card, onComplete]);

  const showSeal =
    !card ||
    phase === "charge" ||
    phase === "crack" ||
    phase === "blackout" ||
    (active && phase !== "reveal");

  const showCard = !!card && (phase === "reveal" || (phase === "idle" && !active));

  const status = useMemo(() => {
    if (!last || !showCard) return null;
    if (last.isNew) return "新カード";
    if (last.leveled) return "レベル上昇";
    return "重複";
  }, [last, showCard]);

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center">
      {phase === "blackout" ? <div className="summon-blackout" aria-hidden /> : null}

      <div className="relative flex h-[180px] w-[120px] items-center justify-center">
        {showSeal ? (
          <SealPlaque phase={active || phase !== "idle" ? phase : "idle"} rarity={active ? rarity : null} />
        ) : null}
        {showCard && card ? (
          <div
            className={cn(
              "summon-reveal absolute inset-0 flex items-center justify-center",
              phase === "reveal" && "summon-reveal--in",
              phase === "idle" && "summon-reveal--shown",
              rarity && `summon-reveal--${rarity.toLowerCase()}`,
            )}
          >
            <CardFace card={card} size="md" />
          </div>
        ) : null}
      </div>

      <div className="mt-3 min-h-[3.25rem] text-center">
        {showCard && card ? (
          <>
            <p className="font-display text-lg leading-tight">{card.name}</p>
            <p className="text-sm text-brass">{status}</p>
          </>
        ) : (
          <p className="text-sm text-faint">
            {phase === "charge" || phase === "crack" || phase === "blackout" ? "封印が解ける…" : "封印の札"}
          </p>
        )}
      </div>
    </div>
  );
}
