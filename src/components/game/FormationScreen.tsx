import { useMemo, useState } from "react";
import {
  CARD_BY_ID,
  FACTION_IDS,
  FACTION_LABEL,
  FORMATIONS,
  scaledStat,
  TYPE_IDS,
  TYPE_LABEL,
} from "@/game/data";
import { formationOfLeader } from "@/game/combat";
import type { ElementType, Faction, Rarity } from "@/game/types";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, CostHex, GoldChip, PrimaryButton, Shell, StatRow, TypeHex } from "./pieces";
import { cn } from "@/lib/utils";

type SortKey = "costDesc" | "costAsc" | "lvDesc" | "lvAsc" | "name" | "rarity" | "statDesc";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "costDesc", label: "コスト↓" },
  { id: "costAsc", label: "コスト↑" },
  { id: "lvDesc", label: "Lv↓" },
  { id: "lvAsc", label: "Lv↑" },
  { id: "name", label: "名前" },
  { id: "rarity", label: "レア" },
  { id: "statDesc", label: "ステ合計↓" },
];

const RARITY_RANK: Record<Rarity, number> = { SP: 4, H: 3, S: 2, N: 1 };

const selectCls =
  "h-11 min-h-11 min-w-0 flex-1 rounded-sm bg-surface px-2 text-xs text-fg hairline outline-none focus:ring-1 focus:ring-brass/50";

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

  const [faction, setFaction] = useState<Faction | "all">("all");
  const [elType, setElType] = useState<ElementType | "all">("all");
  const [hideFodder, setHideFodder] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("costDesc");

  // Empty party: preview selected non-fodder card's formation on the 3×3 before place.
  // Once a leader exists, keep that formation until 「リーダーにする」.
  const previewLeaderId =
    leaderId ??
    (selected && !CARD_BY_ID[selected]?.fodder ? selected : null);
  const form = formationOfLeader(previewLeaderId);
  const cost = partyCost(party);
  const cap = currentCostCap(captured);
  const over = cost > cap;
  const costPct = cap > 0 ? Math.min(100, (cost / cap) * 100) : 0;
  const inParty = new Set(party.filter(Boolean) as string[]);

  const tray = useMemo(() => {
    const cards = Object.keys(owned)
      .map((id) => CARD_BY_ID[id])
      .filter((c): c is NonNullable<typeof c> => !!c)
      .filter((c) => (faction === "all" || c.faction === faction) && (elType === "all" || c.type === elType))
      .filter((c) => !(hideFodder && c.fodder));

    const levelOf = (id: string) => owned[id]?.level ?? 1;
    const statSum = (c: (typeof cards)[number]) => {
      const lv = levelOf(c.id);
      return scaledStat(c.hp, lv) + scaledStat(c.atk, lv) + scaledStat(c.def, lv) + scaledStat(c.spd, lv);
    };

    cards.sort((a, b) => {
      // Keep fodder after non-fodder unless sorting by name only.
      if (sortKey !== "name") {
        const fodderDiff = Number(!!a.fodder) - Number(!!b.fodder);
        if (fodderDiff !== 0) return fodderDiff;
      }

      let primary = 0;
      switch (sortKey) {
        case "costDesc":
          primary = b.cost - a.cost;
          break;
        case "costAsc":
          primary = a.cost - b.cost;
          break;
        case "lvDesc":
          primary = levelOf(b.id) - levelOf(a.id);
          break;
        case "lvAsc":
          primary = levelOf(a.id) - levelOf(b.id);
          break;
        case "name":
          primary = a.name.localeCompare(b.name, "ja");
          break;
        case "rarity":
          primary = RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
          break;
        case "statDesc":
          primary = statSum(b) - statSum(a);
          break;
      }
      if (primary !== 0) return primary;
      // Stable secondary: cost↓ then name
      return b.cost - a.cost || a.name.localeCompare(b.name, "ja");
    });

    return cards;
  }, [owned, faction, elType, hideFodder, sortKey]);

  const focus = selected ? CARD_BY_ID[selected] : null;
  const focusOwn = focus ? owned[focus.id] : null;

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
          <p className="shrink-0 px-0.5 text-[14px] leading-snug text-muted">
            カードかマスを選んで置きたいマスへ。同じマスでもう一度で外す。リーダーを外すと全員解除。
          </p>

          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <select
              aria-label="勢力"
              className={selectCls}
              value={faction}
              onChange={(e) => setFaction(e.target.value as Faction | "all")}
            >
              <option value="all">勢力：全</option>
              {FACTION_IDS.map((f) => (
                <option key={f} value={f}>
                  {FACTION_LABEL[f]}
                </option>
              ))}
            </select>
            <select
              aria-label="属性"
              className={selectCls}
              value={elType}
              onChange={(e) => setElType(e.target.value as ElementType | "all")}
            >
              <option value="all">属性：全</option>
              {TYPE_IDS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select
              aria-label="並び"
              className={selectCls}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  並び：{opt.label}
                </option>
              ))}
            </select>
            <label className="inline-flex h-11 min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm bg-surface px-2 text-xs text-muted hairline">
              <input
                type="checkbox"
                checked={hideFodder}
                onChange={(e) => setHideFodder(e.target.checked)}
                className="h-3.5 w-3.5 accent-brass"
              />
              素材を隠す
            </label>
          </div>

          {focus ? (
            <div className="panel flex shrink-0 items-center gap-2 rounded-md px-2 py-1">
              <TypeHex type={focus.type} className="h-6 w-7 shrink-0 text-xs" />
              <CostHex cost={focus.cost} className="h-6 w-7 shrink-0 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xs leading-tight text-fg">{focus.name}</p>
                <p className="truncate text-[14px] leading-tight text-muted">
                  {FACTION_LABEL[focus.faction]}　{focus.title}
                  <span className="ml-1 text-brass">{focus.rarity}</span>
                </p>
              </div>
              {focus.fodder ? (
                <span className="shrink-0 rounded-sm bg-crimson/20 px-1.5 py-0.5 text-[14px] text-crimson">
                  素材専用
                </span>
              ) : null}
              {inParty.has(focus.id) && !focus.fodder ? (
                <button
                  type="button"
                  onClick={() => setLeader(focus.id)}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center rounded-sm px-3 text-[14px]",
                    leaderId === focus.id ? "bg-brass text-bg" : "bg-raised text-muted",
                  )}
                >
                  {leaderId === focus.id ? "LEADER" : "リーダーにする"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="formation-tray-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="grid auto-rows-min grid-cols-5 content-start gap-1 pb-3 @sm:gap-1.5">
              {tray.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  level={owned[card.id]?.level}
                  skill1Lv={owned[card.id]?.skill1Lv}
                  size="xs"
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

            <div className="flex w-[132px] shrink-0 flex-col gap-1.5 overflow-y-auto @sm:w-[148px]">
              <div className="min-w-0 shrink-0">
                <p className="font-display text-sm leading-tight text-fg">
                  {form.name}
                  {!leaderId && previewLeaderId ? (
                    <span className="ml-1 font-sans text-[14px] font-normal text-muted">（プレビュー）</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[14px] leading-snug text-muted">{form.desc}</p>
              </div>

              {focus ? (
                <div className="shrink-0 space-y-1 rounded-sm bg-bg/40 px-1.5 py-1.5">
                  <div className="flex items-center gap-1">
                    <TypeHex type={focus.type} className="h-5 w-6 shrink-0 text-[12px]" />
                    <CostHex cost={focus.cost} className="h-5 w-6 shrink-0 text-[12px]" />
                    <p className="min-w-0 flex-1 truncate font-display text-[14px] leading-tight text-fg">
                      {focus.name}
                    </p>
                  </div>
                  <p className="truncate text-[13px] leading-tight text-muted">
                    {FACTION_LABEL[focus.faction]}　{focus.rarity}
                  </p>
                  {focus.fodder ? (
                    <span className="inline-block rounded-sm bg-crimson/20 px-1 py-0.5 text-[13px] text-crimson">
                      素材専用
                    </span>
                  ) : null}
                  <StatRow
                    card={focus}
                    level={focusOwn?.level ?? 1}
                    skill1Lv={focusOwn?.skill1Lv ?? 1}
                  />
                  {inParty.has(focus.id) && !focus.fodder ? (
                    <button
                      type="button"
                      onClick={() => setLeader(focus.id)}
                      className={cn(
                        "mt-0.5 inline-flex h-11 w-full shrink-0 items-center justify-center rounded-sm px-1.5 text-[13px]",
                        leaderId === focus.id ? "bg-brass text-bg" : "bg-raised text-muted",
                      )}
                    >
                      {leaderId === focus.id ? "LEADER" : "リーダーにする"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-auto space-y-0.5 rounded-sm bg-bg/40 px-1.5 py-1.5 text-[15px]">
                <p className="mb-1 text-[14px] text-faint">
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
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
      <div className="grid w-full max-w-full grid-cols-3 gap-1 @sm:gap-1.5">
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
                  "aspect-[2/3] w-full flex items-center justify-center overflow-hidden rounded-sm p-0.5",
                  open ? "bg-raised" : "bg-bg/50 opacity-30",
                  selected && open && "ring-1 ring-brass",
                )}
              >
                {card ? (
                  <CardFace
                    card={card}
                    level={owned[card.id]?.level}
                    skill1Lv={owned[card.id]?.skill1Lv}
                    size="xs"
                    leader={leaderId === card.id}
                    className="w-full"
                  />
                ) : open ? (
                  <span className="text-[14px] text-faint">
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
