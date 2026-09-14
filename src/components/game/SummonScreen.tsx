import { CARD_BY_ID, SUMMON_COST } from "@/game/data";
import { useGame } from "@/game/store";
import { CardFace, GoldChip, PrimaryButton, Shell } from "./pieces";

export function SummonScreen() {
  const gold = useGame((s) => s.gold);
  const last = useGame((s) => s.lastSummon);
  const summoning = useGame((s) => s.summoning);
  const summon = useGame((s) => s.summon);
  const card = last ? CARD_BY_ID[last.cardId] : null;

  return (
    <Shell title="召喚" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="summon" wide>
      <div className="flex h-full min-h-0 items-center justify-center gap-8">
        {card ? (
          <CardFace card={card} size="md" />
        ) : (
          <div className="flex h-48 w-32 items-center justify-center rounded-md bg-ink hairline">
            <span className="font-display text-3xl text-brass-dim">召</span>
          </div>
        )}
        <div className="max-w-xs">
          <p className="text-sm leading-relaxed text-muted">
            {SUMMON_COST}金で一枚。重複はレベルになる。URは稀。
          </p>
          {card ? (
            <>
              <p className="mt-3 font-display text-lg">{card.name}</p>
              <p className="text-sm text-brass">
                {last?.isNew ? "新カード" : last?.leveled ? "レベル上昇" : "重複"}
              </p>
            </>
          ) : null}
          <PrimaryButton
            onClick={summon}
            disabled={gold < SUMMON_COST || summoning}
            className="mt-4 min-w-40"
          >
            {gold < SUMMON_COST ? "金が足りない" : "召喚する"}
          </PrimaryButton>
        </div>
      </div>
    </Shell>
  );
}
