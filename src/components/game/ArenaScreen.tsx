import {
  ARENA_TIERS,
  ARENA_TIER_META,
  SPIRIT_MAX,
  arenaCostHint,
  arenaFee,
  arenaReward,
  arenaSpiritCost,
  partyAverageLevel,
  partyTotalCost,
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
  const foeCostHint = arenaCostHint(myCost, tier);
  const fee = arenaFee(tier, avg);
  const reward = arenaReward(tier, fee);
  const cost = arenaSpiritCost(tier);
  const canFight = !!leaderId && partySize > 0;
  const canPay = spirit >= cost;
  const meta = ARENA_TIER_META[tier];

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
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm leading-relaxed text-muted">
            闘気を消費してランダムな英雄隊と戦う。敗北しても闘気は戻らない。
            報酬の金は勝利時のみ。試し撃ちとは別の勝負だ。1分で互角1回分が回復する。
          </p>
          <p className="text-xs text-faint">
            パーティ平均 Lv.{avg.toFixed(1)}　人数 {partySize}　コスト {myCost}
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
                    "rounded-lg px-2 py-3 text-left hairline transition",
                    selected ? "bg-brass/25 text-fg" : "bg-surface/80 text-muted",
                    locked && "opacity-60",
                  )}
                >
                  <p className="font-display text-base text-fg">{m.name}</p>
                  <p className="mt-0.5 text-[10px] text-faint">敵 ×{m.levelMul.toFixed(1)}</p>
                  <p className={cn("mt-1 text-xs tabular", locked ? "text-crimson" : "text-brass")}>
                    闘気 {c}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="w-full max-w-lg rounded-lg bg-surface/80 px-4 py-3 hairline">
            <p className="text-sm text-fg">
              {meta.name}　消費 闘気{cost}　→　勝利報酬 {reward}金
            </p>
            <p className="mt-1 text-xs text-muted">{meta.blurb}</p>
            <p className="mt-1 text-[10px] text-faint">
              敵レベル目安 Lv.{Math.max(1, Math.round(avg * meta.levelMul))}　人数は自軍±1（3〜5）
              　相手目安コスト ~{foeCostHint}
            </p>
          </div>
          {hint ? <p className="text-sm text-crimson">{hint}</p> : null}
          {!canPay && canFight ? (
            <p className="text-sm text-crimson">闘気が足りない（必要 {cost}／現在 {spirit}）</p>
          ) : null}
          <div className="flex gap-3">
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
      </div>
    </Shell>
  );
}
