import {
  ARENA_TIERS,
  ARENA_TIER_META,
  arenaFee,
  arenaReward,
  partyAverageLevel,
  type ArenaTier,
} from "@/game/arena";
import { useGame } from "@/game/store";
import { useState } from "react";
import { GhostButton, GoldChip, PrimaryButton, Shell } from "./pieces";
import { cn } from "@/lib/utils";

export function ArenaScreen() {
  const gold = useGame((s) => s.gold);
  const party = useGame((s) => s.party);
  const owned = useGame((s) => s.owned);
  const leaderId = useGame((s) => s.leaderId);
  const setScreen = useGame((s) => s.setScreen);
  const startArena = useGame((s) => s.startArena);
  const [tier, setTier] = useState<ArenaTier>("even");
  const [hint, setHint] = useState<string | null>(null);

  const avg = partyAverageLevel(party, owned);
  const partySize = party.filter(Boolean).length;
  const fee = arenaFee(tier, avg);
  const reward = arenaReward(tier, fee);
  const canFight = !!leaderId && partySize > 0;
  const canPay = gold >= fee;
  const meta = ARENA_TIER_META[tier];

  const onConfirm = () => {
    const res = startArena(tier);
    if (!res.ok) setHint(res.reason);
    else setHint(null);
  };

  return (
    <Shell
      title="闘技場"
      extra={<GoldChip gold={gold} />}
      bg="/bg/palace.jpg"
      onBack={() => setScreen("palace")}
      wide
    >
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm leading-relaxed text-muted">
            入場料を先に払い、ランダムな英雄隊と戦う。敗北しても入場料は戻らない。
            報酬は勝利時のみ。試し撃ちとは別の勝負だ。
          </p>
          <p className="text-xs text-faint">
            パーティ平均 Lv.{avg.toFixed(1)}　人数 {partySize}
            {!leaderId ? "　リーダー未設定" : ""}
          </p>
          <div className="grid w-full max-w-lg grid-cols-3 gap-2">
            {ARENA_TIERS.map((id) => {
              const m = ARENA_TIER_META[id];
              const f = arenaFee(id, avg);
              const selected = tier === id;
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
                  )}
                >
                  <p className="font-display text-base text-fg">{m.name}</p>
                  <p className="mt-0.5 text-[10px] text-faint">敵 ×{m.levelMul.toFixed(1)}</p>
                  <p className="mt-1 text-xs tabular text-brass">{f} 金</p>
                </button>
              );
            })}
          </div>
          <div className="w-full max-w-lg rounded-lg bg-surface/80 px-4 py-3 hairline">
            <p className="text-sm text-fg">
              {meta.name}　入場 {fee}金　→　勝利報酬 {reward}金
            </p>
            <p className="mt-1 text-xs text-muted">{meta.blurb}</p>
            <p className="mt-1 text-[10px] text-faint">
              敵レベル目安 Lv.{Math.max(1, Math.round(avg * meta.levelMul))}　人数は自軍±1（3〜5）
            </p>
          </div>
          {hint ? <p className="text-sm text-crimson">{hint}</p> : null}
          {!canPay && canFight ? (
            <p className="text-sm text-crimson">金が足りない（必要 {fee}）</p>
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
              {canFight ? (canPay ? `${fee}金で挑戦` : "金が足りない") : "編成が必要"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}
