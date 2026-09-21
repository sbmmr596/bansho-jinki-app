import { useCallback, useState } from "react";
import { SUMMON_COST } from "@/game/data";
import { useGame } from "@/game/store";
import { GoldChip, PrimaryButton, Shell } from "./pieces";
import { SummonReveal } from "./SummonReveal";

export function SummonScreen() {
  const gold = useGame((s) => s.gold);
  const last = useGame((s) => s.lastSummon);
  const summoning = useGame((s) => s.summoning);
  const summon = useGame((s) => s.summon);
  const finishSummon = useGame((s) => s.finishSummon);
  const [busy, setBusy] = useState(false);
  const [pullKey, setPullKey] = useState(0);

  const onComplete = useCallback(() => {
    setBusy(false);
    finishSummon();
  }, [finishSummon]);

  const onSummon = () => {
    if (gold < SUMMON_COST || busy || summoning) return;
    setBusy(true);
    setPullKey((k) => k + 1);
    summon();
  };

  const locked = busy || summoning || gold < SUMMON_COST;

  return (
    <Shell title="召喚" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="summon" wide>
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex w-full max-w-3xl items-center justify-center gap-8">
          <SummonReveal key={pullKey} last={last} active={busy} onComplete={onComplete} />
          <div className="max-w-xs shrink-0">
            <p className="text-sm leading-relaxed text-muted">
              {SUMMON_COST}金で一枚。重複はレベルになる。SPは稀。
            </p>
            <PrimaryButton onClick={onSummon} disabled={locked} className="mt-4 h-11 min-w-40">
              {gold < SUMMON_COST ? "金が足りない" : busy ? "召喚中…" : "召喚する"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}
