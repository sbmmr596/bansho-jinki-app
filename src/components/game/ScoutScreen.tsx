import { SORTIE_SPIRIT, SPIRIT_MAX } from "@/game/arena";
import { CARD_BY_ID, COUNTER_OF, FORMATIONS, TYPE_LABEL } from "@/game/data";
import { scaleEnemyLevel } from "@/game/difficulty";
import { formationOfLeader, typeMod } from "@/game/combat";
import { rankForXp } from "@/game/rank";
import { findStageNode } from "@/game/solo-map";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, GhostButton, PrimaryButton, Shell, SpiritChip, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

export function ScoutScreen() {
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const party = useGame((s) => s.party);
  const leaderId = useGame((s) => s.leaderId);
  const setScreen = useGame((s) => s.setScreen);
  const startBattle = useGame((s) => s.startBattle);
  const difficulty = useGame((s) => s.difficulty);
  const stage = useGame((s) => s.stage);
  const xp = useGame((s) => s.xp);
  const spirit = useGame((s) => s.spirit);
  const holdWins = useGame((s) => s.holdWins);
  const node = scoutNodeId ? findStageNode(rankForXp(xp), stage, scoutNodeId) : null;
  if (!node) return null;

  const enemyLeader = node.enemy.find((e) => e.leader)?.cardId ?? null;
  const eForm =
    (node.enemyFormation && FORMATIONS[node.enemyFormation]) ||
    formationOfLeader(enemyLeader);
  const pForm = formationOfLeader(leaderId);
  const cost = partyCost(party);
  const cap = currentCostCap(xp);
  const canSpirit = spirit >= SORTIE_SPIRIT;
  const counters = COUNTER_OF[node.hint];
  const enemyTypes = node.enemy.map((e) => CARD_BY_ID[e.cardId]?.type).filter(Boolean);
  const hasCounter = party.some((id) => {
    const c = id ? CARD_BY_ID[id] : null;
    if (!c) return false;
    return enemyTypes.some((t) => t && typeMod(c.type, t) > 1);
  });
  const canGo = !!leaderId && cost <= cap && cost > 0 && canSpirit;

  const enemyParty: (string | null)[] = Array(9).fill(null);
  for (const e of node.enemy) enemyParty[e.slot] = e.cardId;

  return (
    <Shell title={node.name} onBack={() => setScreen("map")} nav="map" wide extra={<SpiritChip spirit={spirit} max={SPIRIT_MAX} />}>
      <div className="flex h-full min-h-0 w-full items-stretch gap-4 overflow-hidden px-1 py-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-2 overflow-y-auto pl-1">
          <p className="text-sm leading-relaxed text-muted">{node.blurb}</p>
          {(node.holdNeed ?? 1) > 1 ? (
            <p className="text-sm text-brass">
              占領まで {node.holdNeed! - (holdWins[node.id] ?? 0)} 勝
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">敵の傾向</span>
            <TypeBadge type={node.hint} />
            <span className="text-xs text-muted">
              刺さる属性 {counters.map((t) => TYPE_LABEL[t]).join("・")}
            </span>
          </div>
          <p className="text-xs text-faint">
            報酬 {node.reward.gold}金
            {node.reward.cardId ? `　${CARD_BY_ID[node.reward.cardId]?.name}` : ""}
          </p>
          <p className="text-xs text-muted">
            自陣 {pForm.name}　{cost}/{cap}
            {!hasCounter ? "　有利属性がいない" : "　有利あり"}
          </p>
          {leaderId ? (
            <p className="text-[14px] text-faint">{FORMATIONS[pForm.id]?.desc ?? pForm.desc}</p>
          ) : (
            <p className="text-xs text-crimson">リーダー未設定</p>
          )}
          <p className="text-xs text-muted">出撃で闘気を{SORTIE_SPIRIT}使う。足りないと出られない。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <GhostButton onClick={() => setScreen("formation")} className="min-w-36">
              編成を見直す
            </GhostButton>
            <PrimaryButton onClick={startBattle} disabled={!canGo} className="min-w-36">
              {canSpirit ? "出撃" : "闘気が足りない"}
            </PrimaryButton>
          </div>
        </div>
        {/*
          敵陣は画面右・左向き（戦闘画面と同じ向かい合わせ）。列は [2,1,0] の順で、前列(col 2)が中央寄り(左)。
          3×3 of 2:3 cells ⇒ board ≈ 2:3. Size by container height+width so the
          board always fits between header and bottom nav (no top/bottom clip).
        */}
        <div className="flex min-h-0 w-[min(42%,22rem)] shrink-0 flex-col overflow-hidden">
          <p className="mb-1 shrink-0 text-right text-[14px] leading-none text-faint">
            敵陣 {eForm.name}　前←
          </p>
          <div
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
            style={{ containerType: "size" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="grid grid-cols-3 gap-1"
                style={{ width: "min(100cqw, calc(100cqh * 2 / 3))" }}
              >
                {[0, 1, 2].map((row) =>
                  [2, 1, 0].map((col) => {
                    const slot = row * 3 + col;
                    const id = enemyParty[slot];
                    const card = id ? CARD_BY_ID[id] : null;
                    const eu = node.enemy.find((e) => e.slot === slot);
                    const occupied = !!card && !!eu;
                    const open = !!eForm.slots[slot];
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-md border border-dashed p-0.5",
                          open ? "border-crimson/40 bg-surface/70" : "border-transparent opacity-30",
                        )}
                      >
                        {occupied ? (
                          <CardFace
                            card={card}
                            level={scaleEnemyLevel(eu.level, difficulty)}
                            size="xs"
                            leader={!!eu.leader}
                            faceRight={false}
                            className="!h-full !w-full max-h-full max-w-full"
                          />
                        ) : open ? (
                          <span className="text-[13px] text-faint">空</span>
                        ) : null}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </Shell>
  );
}
