import { SPIRIT_MAX } from "@/game/arena";
import { CARD_BY_ID, NODES } from "@/game/data";
import { difficultyLabel } from "@/game/difficulty";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { useEffect } from "react";
import { CardFace, GoldChip, PrimaryButton, Shell, SpiritChip } from "./pieces";

export function PalaceScreen() {
  const gold = useGame((s) => s.gold);
  const spirit = useGame((s) => s.spirit);
  const tickSpirit = useGame((s) => s.tickSpirit);
  const captured = useGame((s) => s.captured);
  const party = useGame((s) => s.party);
  const leaderId = useGame((s) => s.leaderId);
  const owned = useGame((s) => s.owned);
  const difficulty = useGame((s) => s.difficulty);
  const setScreen = useGame((s) => s.setScreen);
  const setHelp = useGame((s) => s.setHelp);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const resetAll = useGame((s) => s.resetAll);
  const leader = leaderId ? CARD_BY_ID[leaderId] : null;
  const cap = currentCostCap(captured);
  const held = captured.filter((id) => NODES.some((n) => n.id === id)).length;
  const capturePct = Math.round((held / NODES.length) * 100);

  useEffect(() => {
    tickSpirit();
    const id = window.setInterval(() => tickSpirit(), 15_000);
    return () => window.clearInterval(id);
  }, [tickSpirit]);

  return (
    <Shell title="始原の社" extra={<span className="inline-flex items-center gap-2"><SpiritChip spirit={spirit} max={SPIRIT_MAX} /><GoldChip gold={gold} /></span>} bg="/bg/palace.jpg" nav="palace" wide>
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex w-full max-w-3xl items-stretch gap-6">
          <div className="flex shrink-0 items-center">
            {leader ? (
              <CardFace card={leader} level={owned[leader.id]?.level} size="md" leader />
            ) : (
              <div className="flex h-40 w-28 items-center justify-center rounded-md bg-surface text-xs text-crimson hairline">
                リーダー未設定
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <p className="text-sm leading-relaxed text-muted">
              神域大戦。接する未占領だけが見える。陣地を広げ、帝都を制せ。
            </p>
            <div className="grid max-w-md grid-cols-4 gap-2">
              <Stat label="領地" value={`${capturePct}%`} />
              <Stat label="所持" value={`${Object.keys(owned).length}`} />
              <Stat label="コスト" value={`${partyCost(party)}/${cap}`} />
              <Stat label="難易度" value={difficultyLabel(difficulty)} compact />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={() => setScreen("map")} className="min-w-40">
                出陣する
              </PrimaryButton>
              <PrimaryButton onClick={() => setScreen("arena")} className="min-w-32">
                闘技場
              </PrimaryButton>
              <button type="button" onClick={() => setHelp(true)} className="h-12 px-1 text-base text-muted">
                属性相性
              </button>
              <button type="button" onClick={() => setCatalogOpen(true)} className="h-12 px-1 text-base text-muted">
                マイデータ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("進行を消して最初からにしますか？")) resetAll();
                }}
                className="h-12 px-1 text-sm text-faint"
              >
                進行を消す
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-md bg-surface/80 px-2 py-1.5 hairline">
      <p className="text-[12px] text-faint">{label}</p>
      <p className={compact ? "text-sm text-fg" : "text-base tabular text-fg"}>{value}</p>
    </div>
  );
}
