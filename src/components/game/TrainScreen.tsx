import { CARD_BY_ID, MAX_LEVEL, MAX_RANK, scaledStat, trainCost } from "@/game/data";
import { useGame } from "@/game/store";
import { CardFace, GoldChip, PrimaryButton, Shell } from "./pieces";
import { cn } from "@/lib/utils";

export function TrainScreen() {
  const owned = useGame((s) => s.owned);
  const gold = useGame((s) => s.gold);
  const selected = useGame((s) => s.selectedCardId);
  const setSelected = useGame((s) => s.setSelected);
  const trainGold = useGame((s) => s.trainGold);
  const trainFuse = useGame((s) => s.trainFuse);

  const tray = Object.keys(owned)
    .map((id) => CARD_BY_ID[id])
    .filter(Boolean)
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "ja"));
  const focusId = selected && owned[selected] ? selected : (tray[0]?.id ?? null);
  const card = focusId ? CARD_BY_ID[focusId] : null;
  const own = focusId ? owned[focusId] : null;
  const rank = own?.rank ?? 0;
  const lvMax = !!own && own.level >= MAX_LEVEL;
  const rankMax = !!own && rank >= MAX_RANK;
  const cost = own ? trainCost(own.level) : 0;
  const canGold = !!own && !lvMax && gold >= cost;
  const canFuse = !!own && !rankMax && own.count >= 2;

  return (
    <Shell title="育成" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="train" wide>
      <div className="flex h-full min-h-0 gap-3">
        <div className="flex w-[300px] shrink-0 items-center gap-3">
          {card && own ? (
            <>
              <CardFace card={card} level={own.level} rank={rank} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm text-fg">{card.name}</p>
                <p className="text-[10px] text-muted">
                  Lv.{own.level}/{MAX_LEVEL}
                  <span className="ml-1 text-brass">+{rank}/{MAX_RANK}</span>
                  {"　"}所持 {own.count}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px]">
                  <Grow k="HP" base={card.hp} lv={own.level} rank={rank} lvMax={lvMax} />
                  <Grow k="攻" base={card.atk} lv={own.level} rank={rank} lvMax={lvMax} />
                  <Grow k="防" base={card.def} lv={own.level} rank={rank} lvMax={lvMax} />
                  <Grow k="速" base={card.spd} lv={own.level} rank={rank} lvMax={lvMax} />
                </dl>
                <div className="mt-2 flex flex-col gap-1.5">
                  {lvMax ? (
                    <p className="text-[11px] text-brass">レベルは最大。</p>
                  ) : (
                    <PrimaryButton
                      onClick={() => trainGold(card.id)}
                      disabled={!canGold}
                      className="h-9 text-xs"
                    >
                      {canGold ? `金で鍛える ${cost}` : gold < cost ? "金が足りない" : "鍛えられない"}
                    </PrimaryButton>
                  )}
                  {rankMax ? (
                    <p className="text-[11px] text-brass">合成は+99まで。</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => trainFuse(card.id)}
                      disabled={!canFuse}
                      className="flex h-9 items-center justify-center rounded-lg bg-surface text-xs hairline disabled:opacity-40"
                    >
                      {canFuse ? `同名合成 +${rank + 1}` : "同名が足りない"}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">育てるカードがない。</p>
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <p className="mb-1 text-[10px] text-muted">金でLv、同名で合成ランク。ランクはステータスを上げる。</p>
          <div className="flex h-[calc(100%-1.25rem)] gap-2">
            {tray.map((c) => (
              <div key={c.id} className="flex h-full shrink-0 flex-col">
                <CardFace
                  card={c}
                  level={owned[c.id]?.level}
                  rank={owned[c.id]?.rank}
                  size="xs"
                  selected={focusId === c.id}
                  onClick={() => setSelected(c.id)}
                />
                <p
                  className={cn(
                    "mt-1 text-center text-[10px] tabular",
                    (owned[c.id]?.level ?? 1) >= MAX_LEVEL ? "text-brass" : "text-muted",
                  )}
                >
                  ×{owned[c.id]?.count ?? 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Grow({
  k,
  base,
  lv,
  rank,
  lvMax,
}: {
  k: string;
  base: number;
  lv: number;
  rank: number;
  lvMax: boolean;
}) {
  const now = scaledStat(base, lv, rank);
  const next = scaledStat(base, lv + 1, rank);
  return (
    <div className="rounded-md bg-raised py-1">
      <div className="text-faint">{k}</div>
      <div className="tabular text-fg">
        {now}
        {!lvMax ? <span className="text-brass"> →{next}</span> : null}
      </div>
    </div>
  );
}
