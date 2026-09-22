import {
  ARENA_TIERS,
  ARENA_TIER_META,
  SPIRIT_MAX,
  arenaCostHint,
  arenaFee,
  arenaLevelSumHint,
  arenaRewardEstimate,
  arenaSpiritCost,
  partyAverageLevel,
  partyLevels,
  partySkill1Lvs,
  partyTotalCost,
  partyTotalLevel,
  type ArenaTier,
} from "@/game/arena";
import { useGame } from "@/game/store";
import { useEffect, useState } from "react";
import { GhostButton, GoldChip, PrimaryButton, Shell, SpiritChip } from "./pieces";
import { cn } from "@/lib/utils";

export function ArenaScreen() {
  const gold = useGame((s) => s.gold);
  const spirit = useGame((s) => s.spirit);
  const party = useGame((s) => s.party);
  const owned = useGame((s) => s.owned);
  const leaderId = useGame((s) => s.leaderId);
  const setScreen = useGame((s) => s.setScreen);
  const startArena = useGame((s) => s.startArena);
  const tickSpirit = useGame((s) => s.tickSpirit);
  const [tier, setTier] = useState<ArenaTier>("even");
  const [hint, setHint] = useState<string | null>(null);

  // Keep 闘気 HUD fresh while the screen is open.
  useEffect(() => {
    tickSpirit();
    const id = window.setInterval(() => tickSpirit(), 1000);
    return () => window.clearInterval(id);
  }, [tickSpirit]);

  const avg = partyAverageLevel(party, owned);
  const partySize = party.filter(Boolean).length;
  const myCost = partyTotalCost(party);
  const myLevelSum = partyTotalLevel(party, owned);
  const levels = partyLevels(party, owned);
  const skill1Lvs = partySkill1Lvs(party, owned);
  const foeCostHint = arenaCostHint(myCost, tier);
  const foeLevelHint = arenaLevelSumHint(myLevelSum, tier);
  const fee = arenaFee(tier, avg);
  const reward = arenaRewardEstimate(tier, avg, myCost, levels, skill1Lvs);
  const cost = arenaSpiritCost(tier);
  const canFight = !!leaderId && partySize > 0;
  const canPay = spirit >= cost;
  const meta = ARENA_TIER_META[tier];
  const countHint =
    tier === "even" ? "人数は自軍と同じ" : "人数は自軍準拠（3〜5）";

  const onConfirm = () => {
    const res = startArena(tier);
    if (!res.ok) setHint(res.reason);
    else setHint(null);
  };

  return (
    <Shell
      title="闘技場"
      extra={
        <span className="inline-flex items-center gap-2">
          <SpiritChip spirit={spirit} max={SPIRIT_MAX} />
          <GoldChip gold={gold} />
        </span>
      }
      bg="/bg/palace.jpg"
      onBack={() => setScreen("palace")}
      wide
    >
      {/* Short landscape: scroll body, pin actions so 挑戦 stays visible */}
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-2 py-1 @sm:gap-3">
            <p className="max-w-md text-center text-xs leading-relaxed text-muted @sm:text-sm">
              闘気を消費してランダムな英雄隊と戦う。敗北しても闘気は戻らない。
              報酬の金は勝利時のみ（相手の強さに応じて変動）。1分で互角1回分が回復する。
            </p>
            <p className="text-[10px] text-faint @sm:text-xs">
              パーティ平均 Lv.{avg.toFixed(1)}　合計Lv {myLevelSum}　人数 {partySize}　コスト {myCost}
              {!leaderId ? "　リーダー未設定" : ""}
            </p>
            <div className="grid w-full max-w-lg grid-cols-3 gap-2">
              {ARENA_TIERS.map((id) => {
                const m = ARENA_TIER_META[id];
                const c = arenaSpiritCost(id);
                const selected = tier === id;
                const locked = spirit < c;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTier(id);
                      setHint(null);
                    }}
                    className={cn(
                      "rounded-lg px-2 py-2 text-left hairline transition @sm:py-3",
                      selected ? "bg-brass/25 text-fg" : "bg-surface/80 text-muted",
                      locked && "opacity-60",
                    )}
                  >
                    <p className="font-display text-sm text-fg @sm:text-base">{m.name}</p>
                    <p className="mt-0.5 text-[10px] text-faint">合計Lv ×{m.levelMul.toFixed(2)}</p>
                    <p className={cn("mt-1 text-xs tabular", locked ? "text-crimson" : "text-brass")}>
                      闘気 {c}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="w-full max-w-lg rounded-lg bg-surface/80 px-3 py-2 hairline @sm:px-4 @sm:py-3">
              <p className="text-sm text-fg">
                {meta.name}　消費 闘気{cost}　→　勝利報酬 約{reward}金
              </p>
              <p className="mt-1 text-xs text-muted">{meta.blurb}</p>
              <p className="mt-1 text-[10px] text-faint">
                相手目安 合計Lv ~{foeLevelHint}　{countHint}
                　相手目安コスト ~{foeCostHint}
                {tier === "even" ? "　スキルLv1" : tier === "strong" ? "　スキルLv1〜2" : "　スキルLv2〜3"}
              </p>
              <p className="mt-0.5 text-[10px] text-faint">基準報酬 {Math.round(fee * meta.rewardMul)}金 × 戦力比</p>
            </div>
            {hint ? <p className="text-sm text-crimson">{hint}</p> : null}
            {!canPay && canFight ? (
              <p className="text-sm text-crimson">闘気が足りない（必要 {cost}／現在 {spirit}）</p>
            ) : null}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-2xl shrink-0 justify-center gap-3 border-t border-white/10 bg-ink/80 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm">
          <GhostButton onClick={() => setScreen("palace")} className="h-11 min-w-28">
            本拠へ
          </GhostButton>
          <PrimaryButton
            onClick={onConfirm}
            disabled={!canFight || !canPay}
            className="h-11 min-w-36"
          >
            {canFight ? (canPay ? `闘気${cost}で挑戦` : "闘気が足りない") : "編成が必要"}
          </PrimaryButton>
        </div>
      </div>
    </Shell>
  );
}
