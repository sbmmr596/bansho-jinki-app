import { SPIRIT_MAX } from "@/game/arena";
import { CARD_BY_ID } from "@/game/data";
import { difficultyLabel } from "@/game/difficulty";
import { rankForXp, rankLabel } from "@/game/rank";
import { FIELD_LABEL, soloStage } from "@/game/solo-map";
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
  const stage = useGame((s) => s.stage);
  const xp = useGame((s) => s.xp);
  const setScreen = useGame((s) => s.setScreen);
  const setHelp = useGame((s) => s.setHelp);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const resetAll = useGame((s) => s.resetAll);
  const rank = rankForXp(xp);
  const map = soloStage(rank, stage);
  const leader = leaderId ? CARD_BY_ID[leaderId] : null;
  const cap = currentCostCap(xp);

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
              {rankLabel(rank)}・第{stage}段・経験{xp}。{FIELD_LABEL[map.field]}を、マスと拠点で埋めよ。位が上がると地図とコスト上限が広がる。地形で難易度は変わらない。
            </p>
            <div className="grid max-w-md grid-cols-4 gap-2">
              <Stat
                label="領地"
                value={`${Math.round((captured.filter((id) => map.byId[id]).length / map.nodes.length) * 100)}%`}
              />
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
    <div className="rounded-lg bg-surface/80 px-3 py-2 hairline">
      <p className="text-[14px] font-medium tracking-wide text-muted">{label}</p>
      <p className={"font-display tabular text-fg " + (compact ? "text-sm leading-tight" : "text-lg")}>
        {value}
      </p>
    </div>
  );
}
