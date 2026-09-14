import { useMemo, useState } from "react";
import { CARDS, FACTION_LABEL, FORMATIONS } from "@/game/data";
import type { Faction } from "@/game/types";
import { useGame } from "@/game/store";
import { CardFace, GoldChip, Shell, StatRow, TypeBadge } from "./pieces";

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

  return (
    <Shell title="図鑑" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="collection" wide>
      <div className="flex h-full min-h-0 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto">
            <FilterChip active={faction === "all"} onClick={() => setFaction("all")}>
              全
            </FilterChip>
            {FACTIONS.map((f) => (
              <FilterChip key={f} active={faction === f} onClick={() => setFaction(f)}>
                {FACTION_LABEL[f]}
              </FilterChip>
            ))}
          </div>
          <div className="grid auto-rows-min grid-cols-5 gap-1.5 overflow-y-auto sm:grid-cols-6">
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
                    rank={have?.rank}
                    className="w-full"
                    onClick={() => setFocus(c.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {card ? (
          <div className="panel flex w-[280px] shrink-0 gap-3 overflow-y-auto rounded-lg p-3">
            <CardFace key={card.id} card={card} level={own?.level} rank={own?.rank} size="sm" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-display text-sm text-fg">{card.name}</p>
              <p className="text-muted">{card.title}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <TypeBadge type={card.type} />
                <span className="text-muted">{FACTION_LABEL[card.faction]}</span>
                <span className="text-brass">{card.rarity}</span>
              </div>
              <StatRow card={card} level={own?.level ?? 1} rank={own?.rank ?? 0} />
              {own ? (
                <p className="mt-1 text-muted">所持 {own.count}</p>
              ) : (
                <p className="mt-1 text-faint">未所持</p>
              )}
              <p className="mt-2 text-fg">
                {card.skill.name}
                <span className="ml-1 text-muted">{card.skill.desc}</span>
              </p>
              <p className="mt-1 text-muted">{FORMATIONS[card.formation]?.name}</p>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
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
