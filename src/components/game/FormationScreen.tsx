import { CARD_BY_ID, FACTION_LABEL, FORMATIONS } from "@/game/data";
import { formationOfLeader } from "@/game/combat";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, GoldChip, PrimaryButton, Shell, StatRow } from "./pieces";
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
  const inParty = new Set(party.filter(Boolean) as string[]);
  const tray = Object.keys(owned)
    .map((id) => CARD_BY_ID[id])
    .filter(Boolean)
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "ja"));

  const focusId = selected ?? leaderId ?? tray[0]?.id ?? null;
  const focus = focusId ? CARD_BY_ID[focusId] : null;

  const onSlot = (slot: number) => {
    if (!form.slots[slot]) return;
    if (selected) {
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
        <div className="flex w-[36%] min-w-[150px] max-w-[220px] shrink-0 flex-col gap-1.5">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-sm leading-tight text-fg">{form.name}</p>
              <p className="truncate text-[10px] text-muted">{form.desc}</p>
            </div>
            <p className={cn("tabular shrink-0 text-sm", over ? "text-crimson" : "text-brass")}>
              {cost}/{cap}
            </p>
          </div>
          <FormationMini
            formationId={form.id}
            party={party}
            owned={owned}
            leaderId={leaderId}
            selected={selected}
            onSlot={onSlot}
          />
          <PrimaryButton
            onClick={() => setScreen("map")}
            className="h-9 shrink-0"
            disabled={over || !leaderId}
          >
            出陣へ
          </PrimaryButton>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <p className="mb-1 shrink-0 text-[10px] text-muted">
            カードかマスを選んで置きたいマスへ。同じマスでもう一度で外す。リーダーを外すと全員解除。
          </p>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 gap-1.5 overflow-y-auto content-start pr-0.5">
            {tray.map((card) => (
              <CardFace
                key={card.id}
                card={card}
                level={owned[card.id]?.level}
                rank={owned[card.id]?.rank}
                size="sm"
                selected={selected === card.id}
                dimmed={inParty.has(card.id) && selected !== card.id}
                leader={leaderId === card.id}
                className="w-full"
                onClick={() => onTray(card.id)}
              />
            ))}
          </div>
        </div>

        {focus ? (
          <div className="panel flex w-[168px] shrink-0 flex-col gap-1.5 self-start rounded-lg p-2">
            <p className="font-display text-sm leading-tight">{focus.name}</p>
            <p className="text-[10px] leading-tight text-muted">
              {FACTION_LABEL[focus.faction]}　{focus.title}
            </p>
            <StatRow card={focus} level={owned[focus.id]?.level ?? 1} rank={owned[focus.id]?.rank ?? 0} />
            <p className="text-[11px] leading-snug text-fg">
              {focus.skill.name}
              <span className="ml-1 text-muted">{focus.skill.desc}</span>
            </p>
            {inParty.has(focus.id) ? (
              <button
                type="button"
                onClick={() => setLeader(focus.id)}
                className={cn(
                  "h-7 rounded-sm text-[10px]",
                  leaderId === focus.id ? "bg-brass text-bg" : "bg-raised text-muted",
                )}
              >
                {leaderId === focus.id ? "LEADER" : "リーダーにする"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function FormationMini({
  formationId,
  party,
  owned,
  leaderId,
  selected,
  onSlot,
}: {
  formationId: string;
  party: (string | null)[];
  owned: Record<string, { level: number; rank?: number }>;
  leaderId: string | null;
  selected: string | null;
  onSlot: (slot: number) => void;
}) {
  const formation = FORMATIONS[formationId];
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-1">
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
                  rank={owned[card.id]?.rank}
                  size="xs"
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
  );
}
