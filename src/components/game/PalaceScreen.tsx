import { CARD_BY_ID, NODES } from "@/game/data";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, GoldChip, PrimaryButton, Shell } from "./pieces";

export function PalaceScreen() {
  const gold = useGame((s) => s.gold);
  const captured = useGame((s) => s.captured);
  const party = useGame((s) => s.party);
  const leaderId = useGame((s) => s.leaderId);
  const owned = useGame((s) => s.owned);
  const setScreen = useGame((s) => s.setScreen);
  const setHelp = useGame((s) => s.setHelp);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const resetAll = useGame((s) => s.resetAll);
  const navSide = useGame((s) => s.navSide);
  const setNavSide = useGame((s) => s.setNavSide);
  const won = captured.includes("capital");
  const leader = leaderId ? CARD_BY_ID[leaderId] : null;
  const cap = currentCostCap(captured);

  return (
    <Shell title="始原の社" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="palace" wide>
      <div className="flex h-full min-h-0 items-stretch gap-4">
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
            {won
              ? "帝都は落ちた。万象は、しばらくあなたの手にある。"
              : "本拠から地を広げよ。敵の属性を見て、陣を組み直せ。"}
          </p>
          <div className="grid max-w-md grid-cols-3 gap-2">
            <Stat label="領地" value={`${captured.length}/${NODES.length}`} />
            <Stat label="所持" value={`${Object.keys(owned).length}`} />
            <Stat label="コスト" value={`${partyCost(party)}/${cap}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => setScreen("map")} className="min-w-36">
              出陣する
            </PrimaryButton>
            <button type="button" onClick={() => setHelp(true)} className="h-11 text-sm text-muted">
              属性相性
            </button>
            <button type="button" onClick={() => setCatalogOpen(true)} className="h-11 text-sm text-muted">
              マイデータ
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("進行を消して最初からにしますか？")) resetAll();
              }}
              className="h-11 text-xs text-faint"
            >
              進行を消す
            </button>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap text-faint">操作ボタン</span>
            <div className="flex shrink-0 overflow-hidden rounded-md hairline">
              <button
                type="button"
                onClick={() => setNavSide("right")}
                className={
                  "h-11 w-14 shrink-0 whitespace-nowrap px-2 " +
                  (navSide === "right" ? "bg-brass/25 text-brass" : "bg-surface text-muted")
                }
              >
                右
              </button>
              <button
                type="button"
                onClick={() => setNavSide("left")}
                className={
                  "h-11 w-14 shrink-0 whitespace-nowrap px-2 " +
                  (navSide === "left" ? "bg-brass/25 text-brass" : "bg-surface text-muted")
                }
              >
                左
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface/80 px-3 py-2 hairline">
      <p className="text-[10px] tracking-wide text-faint">{label}</p>
      <p className="font-display text-lg tabular text-fg">{value}</p>
    </div>
  );
}
