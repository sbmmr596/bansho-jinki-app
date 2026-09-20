import { useMemo, useState } from "react";
import { BASIC_SKILL, CARDS, CARD_BY_ID, FACTION_LABEL, FORMATIONS, TYPE_LABEL, skillPowerScale } from "@/game/data";
import { commonSkillName, SKILL_KIND_LABEL } from "@/game/skillNames";
import type { Faction } from "@/game/types";
import { useGame } from "@/game/store";
import { CardFace, GoldChip, Shell, StatRow, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

const FACTIONS: Faction[] = ["koryu", "tekki", "tensho", "metsujin", "reiju", "yukei"];

export function CollectionScreen() {
  const owned = useGame((s) => s.owned);
  const gold = useGame((s) => s.gold);
  const [faction, setFaction] = useState<Faction | "all">("all");
  const [focus, setFocus] = useState<string | null>(CARDS[0]?.id ?? null);
  const list = useMemo(
    () => CARDS.filter((c) => faction === "all" || c.faction === faction),
    [faction],
  );
  const card = focus ? CARDS.find((c) => c.id === focus) : null;
  const own = card ? owned[card.id] : null;
  const form = card ? FORMATIONS[card.formation] : null;

  return (
    <Shell title="図鑑" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="collection" wide>
      <div className="flex h-full min-h-0 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto pb-0.5">
            <FilterChip active={faction === "all"} onClick={() => setFaction("all")}>
              全
            </FilterChip>
            {FACTIONS.map((f) => (
              <FilterChip key={f} active={faction === f} onClick={() => setFaction(f)}>
                {FACTION_LABEL[f]}
              </FilterChip>
            ))}
          </div>
          <div className="grid auto-rows-min grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
            {list.map((c) => {
              const have = owned[c.id];
              return (
                <div key={c.id} className="flex justify-center">
                  <CardFace
                    card={c}
                    level={have?.level}
                    size="xs"
                    dimmed={!have}
                    selected={focus === c.id}
                    skill1Lv={have?.skill1Lv}
                    onClick={() => setFocus(c.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {card ? (
          <aside className="panel flex w-[320px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-lg p-3">
            <div className="flex gap-3">
              <CardFace key={card.id} card={card} level={own?.level} skill1Lv={own?.skill1Lv} size="md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                <p className="font-display text-sm leading-snug text-fg">{card.name}</p>
                <p className="leading-snug text-muted">{card.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={card.type} />
                  <span className="text-muted">{FACTION_LABEL[card.faction]}</span>
                  <span className="text-brass">{card.rarity}</span>
                  {card.fodder ? (
                    <span className="rounded-sm bg-crimson/85 px-1.5 py-0.5 text-[10px] font-semibold text-fg">
                      素材専用
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted">
                  コスト <span className="tabular text-fg">{card.cost}</span>
                </p>
                {own ? (
                  <p className="mt-auto text-muted">所持 {own.count}</p>
                ) : (
                  <p className="mt-auto text-faint">未所持</p>
                )}
              </div>
            </div>

            <div className="border-t border-fg/10 pt-2">
              <StatRow card={card} level={own?.level ?? 1} skill1Lv={own?.skill1Lv ?? 1} />
            </div>

            {/* Fill remaining panel height like original detail: formation + skill */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-fg/10 pt-2">
              <div className="flex items-start gap-2.5 rounded-md bg-raised/50 p-2 hairline">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] tracking-wide text-faint">リーダー陣形</p>
                  <p className="font-display text-sm leading-snug text-fg">{form?.name ?? "—"}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{form?.desc}</p>
                </div>
                {form ? <FormationPreview slots={form.slots} /> : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                <DetailSkill
                  label="基本技"
                  name={BASIC_SKILL.name}
                  desc={BASIC_SKILL.desc}
                  power={BASIC_SKILL.power}
                />
                <DetailSkill
                  label="必殺技1"
                  name={card.skill.name}
                  desc={card.skill.desc}
                  power={card.skill.power}
                  lv={own?.skill1Lv ?? 1}
                  scaled={Math.round(card.skill.power * skillPowerScale(own?.skill1Lv ?? 1))}
                />
                {own?.skill2 && CARD_BY_ID[own.skill2.sourceCardId] ? (
                  <DetailSkill
                    label="必殺技2"
                    name={commonSkillName(
                      CARD_BY_ID[own.skill2.sourceCardId]!.skill,
                      CARD_BY_ID[own.skill2.sourceCardId]!.rarity,
                    )}
                    subName={CARD_BY_ID[own.skill2.sourceCardId]!.skill.name}
                    desc={CARD_BY_ID[own.skill2.sourceCardId]!.skill.desc}
                    power={CARD_BY_ID[own.skill2.sourceCardId]!.skill.power}
                    lv={own.skill2.lv}
                    scaled={Math.round(
                      CARD_BY_ID[own.skill2.sourceCardId]!.skill.power *
                        skillPowerScale(own.skill2.lv),
                    )}
                    tone="s2"
                  />
                ) : (
                  <DetailSkill label="必殺技2" name="-" desc="未装着" empty tone="s2" />
                )}
                <p className="pt-1 text-[10px] text-brass">
                  属性 {TYPE_LABEL[card.type]}　／　種別 {SKILL_KIND_LABEL[card.skill.kind]}
                </p>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </Shell>
  );
}

function FormationPreview({ slots }: { slots: boolean[] }) {
  return (
    <div
      className="grid h-[4.5rem] w-[4.5rem] shrink-0 grid-cols-3 grid-rows-3 gap-0.5"
      aria-hidden
    >
      {[0, 1, 2].map((row) =>
        [2, 1, 0].map((col) => {
          const slot = row * 3 + col;
          const open = slots[slot];
          return (
            <div
              key={slot}
              className={cn(
                "rounded-[2px]",
                open ? "bg-brass/80" : "bg-bg/70 ring-1 ring-fg/10",
              )}
            />
          );
        }),
      )}
    </div>
  );
}

function DetailSkill({
  label,
  name,
  subName,
  desc,
  power,
  lv,
  scaled,
  empty,
  tone,
}: {
  label: string;
  name: string;
  subName?: string;
  desc: string;
  power?: number;
  lv?: number;
  scaled?: number;
  empty?: boolean;
  tone?: "s2";
}) {
  return (
    <div
      className={
        "rounded-md p-2 hairline " +
        (tone === "s2"
          ? empty
            ? "bg-crimson/20"
            : "bg-crimson/10"
          : "bg-raised/50")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-wide text-faint">{label}</p>
        {empty ? (
          <span className="text-[10px] tabular text-crimson">Lv.-</span>
        ) : lv != null ? (
          <span className="text-[10px] tabular text-fg">Lv.{lv}</span>
        ) : null}
      </div>
      <p className={"font-display text-sm " + (empty ? "text-crimson" : "text-fg")}>{name}</p>
      {subName && subName !== name ? (
        <p className="text-[10px] text-faint">{subName}</p>
      ) : null}
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
      {power != null && !empty ? (
        <p className="mt-0.5 text-[10px] text-brass">
          威力:{scaled ?? power}
          {scaled != null && scaled !== power ? `（基礎 ${power}）` : ""}
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-8 shrink-0 rounded-full px-3 text-xs " +
        (active ? "bg-brass text-bg" : "bg-surface text-muted hairline")
      }
    >
      {children}
    </button>
  );
}
