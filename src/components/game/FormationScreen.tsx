import { CARD_BY_ID, FACTION_LABEL, FORMATIONS, scaledStat } from "@/game/data";
import { formationOfLeader } from "@/game/combat";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, CostHex, GoldChip, PrimaryButton, Shell, TypeHex } from "./pieces";
import { cn } from "@/lib/utils";

export function FormationScreen() {
  const party = useGame((s) => s.party);
  const owned = useGame((s) => s.owned);
  const leaderId = useGame((s) => s.leaderId);
  const selected = useGame((s) => s.selectedCardId);
  const captured = useGame((s) => s.captured);
  const gold = useGame((s) => s.gold);
  const setScreen = useGame((s) => s.setScreen);
  const placeCard = useGame((s) => s.placeCard);
  const setLeader = useGame((s) => s.setLeader);
  const setSelected = useGame((s) => s.setSelected);

  const form = formationOfLeader(leaderId);
  const cost = partyCost(party);
  const cap = currentCostCap(captured);
  const over = cost > cap;
  const costPct = cap > 0 ? Math.min(100, (cost / cap) * 100) : 0;
  const inParty = new Set(party.filter(Boolean) as string[]);
  const tray = Object.keys(owned)
    .map((id) => CARD_BY_ID[id])
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => Number(!!a.fodder) - Number(!!b.fodder) || b.cost - a.cost || a.name.localeCompare(b.name, "ja"));

  const focus = selected ? CARD_BY_ID[selected] : null;

  const totals = (() => {
    let count = 0;
    let lvSum = 0;
    let hp = 0;
    let atk = 0;
    let def = 0;
    let spd = 0;
    for (const id of party) {
      if (!id) continue;
      const card = CARD_BY_ID[id];
      if (!card) continue;
      const lv = owned[id]?.level ?? 1;
      count += 1;
      lvSum += lv;
      hp += scaledStat(card.hp, lv);
      atk += scaledStat(card.atk, lv);
      def += scaledStat(card.def, lv);
      spd += scaledStat(card.spd, lv);
    }
    return {
      count,
      avgLv: count ? Math.round((lvSum / count) * 10) / 10 : 0,
      hp,
      atk,
      def,
      spd,
    };
  })();

  const onSlot = (slot: number) => {
    if (!form.slots[slot]) return;
    if (selected) {
      if (CARD_BY_ID[selected]?.fodder) return;
      placeCard(slot, selected);
      return;
    }
    if (party[slot]) setSelected(party[slot]);
  };

  const onTray = (id: string) => {
    setSelected(selected === id ? null : id);
  };

  return (
    <Shell title="編成" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="formation" wide>
      <div className="flex h-full min-h-0 gap-2">
        {/* Left: scrollable card inventory (~55–60%) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <p className="shrink-0 px-0.5 text-[10px] leading-snug text-muted">
            カードかマスを選んで置きたいマスへ。同じマスでもう一度で外す。リーダーを外すと全員解除。
          </p>

          {focus ? (
            <div className="panel flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5">
              <TypeHex type={focus.type} className="h-6 w-7 shrink-0 text-xs" />
              <CostHex cost={focus.cost} className="h-6 w-7 shrink-0 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xs leading-tight text-fg">{focus.name}</p>
                <p className="truncate text-[10px] leading-tight text-muted">
                  {FACTION_LABEL[focus.faction]}　{focus.title}
                </p>
              </div>
              {focus.fodder ? (
                <span className="shrink-0 rounded-sm bg-crimson/20 px-1.5 py-0.5 text-[10px] text-crimson">
                  素材専用
                </span>
              ) : null}
              {inParty.has(focus.id) && !focus.fodder ? (
                <button
                  type="button"
                  onClick={() => setLeader(focus.id)}
                  className={cn(
                    "h-7 shrink-0 rounded-sm px-2 text-[10px]",
                    leaderId === focus.id ? "bg-brass text-bg" : "bg-raised text-muted",
                  )}
                >
                  {leaderId === focus.id ? "LEADER" : "リーダーにする"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="formation-tray-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="grid auto-rows-min grid-cols-4 content-start gap-1 pb-3 sm:gap-1.5">
              {tray.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  level={owned[card.id]?.level}
                  skill1Lv={owned[card.id]?.skill1Lv}
                  size="sm"
                  className="w-full"
                  selected={selected === card.id}
                  dimmed={(inParty.has(card.id) && selected !== card.id) || !!card.fodder}
                  leader={leaderId === card.id}
                  onClick={() => onTray(card.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: party info panel (~40–45%) */}
        <aside className="panel flex w-[min(46%,460px)] min-w-[300px] max-w-[480px] shrink-0 flex-col gap-2 self-stretch overflow-hidden rounded-lg p-2.5">
          <div className="shrink-0 space-y-1">
            <div className="flex items-end justify-between gap-2">
              <p className="font-display text-sm leading-tight text-fg">パーティ情報</p>
              <p className={cn("tabular shrink-0 text-sm font-semibold", over ? "text-crimson" : "text-brass")}>
                {cost}/{cap}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg/70 ring-1 ring-border/40">
              <div
                className={cn("h-full rounded-full transition-[width]", over ? "bg-crimson" : "bg-brass")}
                style={{ width: `${costPct}%` }}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 gap-2">
            <FormationGrid
              formationId={form.id}
              party={party}
              owned={owned}
              leaderId={leaderId}
              selected={selected}
              onSlot={onSlot}
            />

            <div className="flex w-[132px] shrink-0 flex-col gap-1.5 overflow-y-auto sm:w-[148px]">
              <div className="min-w-0">
                <p className="font-display text-sm leading-tight text-fg">{form.name}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted">{form.desc}</p>
              </div>

              <div className="mt-auto space-y-0.5 rounded-sm bg-bg/40 px-1.5 py-1.5 text-[11px]">
                <p className="mb-1 text-[10px] text-faint">
                  {totals.count ? `${totals.count}体　平均Lv ${totals.avgLv}` : "未編成"}
                </p>
                <PartyStat label="HP" value={totals.hp} />
                <PartyStat label="攻" value={totals.atk} />
                <PartyStat label="防" value={totals.def} />
                <PartyStat label="速" value={totals.spd} />
              </div>
            </div>
          </div>

          <PrimaryButton
            onClick={() => setScreen("map")}
            className="h-10 shrink-0"
            disabled={over || !leaderId}
          >
            出陣へ
          </PrimaryButton>
        </aside>
      </div>
    </Shell>
  );
}

function PartyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 tabular">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-fg">{value}</span>
    </div>
  );
}

function FormationGrid({
  formationId,
  party,
  owned,
  leaderId,
  selected,
  onSlot,
}: {
  formationId: string;
  party: (string | null)[];
  owned: Record<string, { level: number; skill1Lv?: number }>;
  leaderId: string | null;
  selected: string | null;
  onSlot: (slot: number) => void;
}) {
  const formation = FORMATIONS[formationId];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div className="grid aspect-square h-full max-h-full w-auto max-w-full grid-cols-3 grid-rows-3 gap-1 sm:gap-1.5">
        {[0, 1, 2].map((row) =>
          [2, 1, 0].map((col) => {
            const slot = row * 3 + col;
            const open = formation.slots[slot];
            const id = party[slot];
            const card = id ? CARD_BY_ID[id] : null;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSlot(slot)}
                className={cn(
                  "flex min-h-0 items-center justify-center overflow-hidden rounded-sm p-0.5",
                  open ? "bg-raised" : "bg-bg/50 opacity-30",
                  selected && open && "ring-1 ring-brass",
                )}
              >
                {card ? (
                  <CardFace
                    card={card}
                    level={owned[card.id]?.level}
                    skill1Lv={owned[card.id]?.skill1Lv}
                    size="sm"
                    leader={leaderId === card.id}
                    className="h-full max-h-full w-auto max-w-full"
                  />
                ) : open ? (
                  <span className="text-[10px] text-faint">
                    {col === 2 ? "前" : col === 1 ? "中" : "後"}
                  </span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
