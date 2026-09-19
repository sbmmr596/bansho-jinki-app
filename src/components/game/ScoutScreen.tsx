import { CARD_BY_ID, COUNTER_OF, FORMATIONS, NODE_BY_ID, TYPE_LABEL } from "@/game/data";
import { scaleEnemyLevel } from "@/game/difficulty";
import { formationOfLeader, typeMod } from "@/game/combat";
import { currentCostCap, partyCost, useGame } from "@/game/store";
import { CardFace, GhostButton, PrimaryButton, Shell, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

export function ScoutScreen() {
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const party = useGame((s) => s.party);
  const leaderId = useGame((s) => s.leaderId);
  const captured = useGame((s) => s.captured);
  const setScreen = useGame((s) => s.setScreen);
  const startBattle = useGame((s) => s.startBattle);
  const difficulty = useGame((s) => s.difficulty);
  const node = scoutNodeId ? NODE_BY_ID[scoutNodeId] : null;
  if (!node) return null;

  const enemyLeader = node.enemy.find((e) => e.leader)?.cardId ?? null;
  const eForm = formationOfLeader(enemyLeader);
  const pForm = formationOfLeader(leaderId);
  const cost = partyCost(party);
  const cap = currentCostCap(captured);
  const counters = COUNTER_OF[node.hint];
  const enemyTypes = node.enemy.map((e) => CARD_BY_ID[e.cardId]?.type).filter(Boolean);
  const hasCounter = party.some((id) => {
    const c = id ? CARD_BY_ID[id] : null;
    if (!c) return false;
    return enemyTypes.some((t) => t && typeMod(c.type, t) > 1);
  });
  const canGo = !!leaderId && cost <= cap && cost > 0;

  const enemyParty: (string | null)[] = Array(9).fill(null);
  for (const e of node.enemy) enemyParty[e.slot] = e.cardId;

  return (
    <Shell title={node.name} onBack={() => setScreen("map")} nav="map" wide>
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex w-full max-w-3xl items-stretch gap-6">
          <div className="flex w-[300px] shrink-0 flex-col">
            <p className="mb-1 text-[10px] text-faint">
              敵陣 {eForm.name}　→前
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
              {[0, 1, 2].map((row) =>
                [0, 1, 2].map((col) => {
                  const slot = row * 3 + col;
                  const id = enemyParty[slot];
                  const card = id ? CARD_BY_ID[id] : null;
                  const eu = node.enemy.find((e) => e.slot === slot);
                  const occupied = !!card && !!eu;
                  // Occupied slots always read as valid cells even if the leader
                  // formation mask would close them (placements are fixed per node).
                  const open = eForm.slots[slot] || occupied;
                  return (
                    <div
                      key={slot}
                      className={cn(
                        "flex items-center justify-center rounded-md border border-dashed p-0.5",
                        open ? "border-crimson/40 bg-surface/70" : "border-transparent opacity-30",
                      )}
                    >
                      {occupied ? (
                        <CardFace card={card} level={scaleEnemyLevel(eu.level, difficulty)} size="mini" leader={!!eu.leader} />
                      ) : open ? (
                        <span className="text-[10px] text-faint">空</span>
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <p className="text-sm leading-relaxed text-muted">{node.blurb}</p>
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
              <p className="text-[10px] text-faint">{FORMATIONS[pForm.id]?.desc}</p>
            ) : (
              <p className="text-xs text-crimson">リーダー未設定</p>
            )}
            <div className="mt-1 flex gap-2">
              <GhostButton onClick={() => setScreen("formation")} className="h-10 min-w-32">
                編成を見直す
              </GhostButton>
              <PrimaryButton onClick={startBattle} disabled={!canGo} className="h-10 min-w-32">
                出撃
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
