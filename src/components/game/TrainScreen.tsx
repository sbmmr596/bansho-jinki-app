import { useMemo, useState } from "react";
import {
  BASIC_SKILL,
  CARD_BY_ID,
  FORMATIONS,
  MAX_LEVEL,
  MAX_SKILL_LV,
  TYPE_LABEL,
  fuseSuccessRate,
  scaledStat,
  skillPowerScale,
  trainCost,
} from "@/game/data";
import { commonSkillName, materialSkillLabel, skill2SameIdentity } from "@/game/skillNames";
import type { FuseResult } from "@/game/types";
import { useGame } from "@/game/store";
import { CardFace, GoldChip, PrimaryButton, Shell, TypeBadge } from "./pieces";
import { cn } from "@/lib/utils";

type SynthMode = "skill1" | "skill2";

export function TrainScreen() {
  const owned = useGame((s) => s.owned);
  const gold = useGame((s) => s.gold);
  const selected = useGame((s) => s.selectedCardId);
  const setSelected = useGame((s) => s.setSelected);
  const trainGold = useGame((s) => s.trainGold);
  const trainFuse = useGame((s) => s.trainFuse);
  const trainFuseOther = useGame((s) => s.trainFuseOther);

  const [mode, setMode] = useState<SynthMode>("skill1");
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<FuseResult | null>(null);

  const tray = Object.keys(owned)
    .map((id) => CARD_BY_ID[id])
    .filter((c): c is NonNullable<typeof c> => !!c && !c.fodder)
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "ja"));
  const focusId = selected && owned[selected] ? selected : (tray[0]?.id ?? null);
  const card = focusId ? CARD_BY_ID[focusId] : null;
  const own = focusId ? owned[focusId] : null;
  const form = card ? FORMATIONS[card.formation] : null;

  const skill1Lv = own?.skill1Lv ?? 1;
  const skill2 = own?.skill2;
  const skill2Card = skill2 ? CARD_BY_ID[skill2.sourceCardId] : null;
  const lvMax = !!own && own.level >= MAX_LEVEL;
  const skill1Max = skill1Lv >= MAX_SKILL_LV;
  const cost = own ? trainCost(own.level) : 0;
  const isFodderBase = !!card?.fodder;
  const canGold = !!own && !lvMax && !isFodderBase && gold >= cost;

  const sameCopies = !!own && own.count >= 2;
  const canSkill1 = !!own && !skill1Max && sameCopies && !isFodderBase;

  const otherMaterials = useMemo(() => {
    if (!focusId) return [];
    return Object.keys(owned)
      .filter((id) => id !== focusId && (owned[id]?.count ?? 0) > 0 && CARD_BY_ID[id])
      .map((id) => CARD_BY_ID[id]!)
      .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "ja"));
  }, [owned, focusId]);

  const matOwn = materialId ? owned[materialId] : null;
  const matCard = materialId ? CARD_BY_ID[materialId] : null;
  const canSkill2 = !!own && !!matCard && !!matOwn && matOwn.count >= 1 && materialId !== focusId;

  const skill2Same = !!(
    skill2Card &&
    matCard &&
    skill2SameIdentity(
      skill2Card.skill.kind,
      skill2Card.rarity,
      matCard.skill.kind,
      matCard.rarity,
    )
  );
  const skill2Label = skill2Card
    ? commonSkillName(skill2Card.skill, skill2Card.rarity)
    : null;
  const matLabel = matCard ? commonSkillName(matCard.skill, matCard.rarity) : null;

  const confirmInfo = useMemo(() => {
    if (!own || !card) return null;
    if (mode === "skill1") {
      if (!canSkill1) return null;
      const rate = fuseSuccessRate(skill1Lv, own.level, own.level);
      return {
        title: "同名合成 — 必殺技1",
        lines: [
          `必殺技Lv：${skill1Lv} → ${skill1Lv + 1}`,
          `成功率：${rate}%`,
          "失敗しても素材は消費されます。",
        ],
        rate,
      };
    }
    if (!canSkill2 || !matCard || !matLabel) return null;
    if (!skill2) {
      return {
        title: "異名合成 — 必殺技2装着",
        lines: [
          `必殺技2に「${matLabel}」を装着`,
          "成功率：100%（装着）",
        ],
        rate: 100,
      };
    }
    if (skill2Same && skill2Card) {
      if (skill2.lv >= MAX_SKILL_LV) {
        return {
          title: "異名合成 — 必殺技2",
          lines: [
            `「${skill2Label}」はすでに Lv.${MAX_SKILL_LV}（最大）`,
            "素材のみ消費されます。",
          ],
          rate: 0,
        };
      }
      const rate = fuseSuccessRate(skill2.lv, own.level, matOwn?.level ?? 1);
      return {
        title: "異名合成 — 必殺技2強化",
        lines: [
          `${skill2Label} Lv${skill2.lv}→${skill2.lv + 1}`,
          `成功率：${rate}%`,
          "失敗しても素材は消費されます。",
        ],
        rate,
      };
    }
    return {
      title: "異名合成 — 必殺技2上書き",
      lines: [
        `必殺2を上書き：${matLabel} Lv.1`,
        "成功率：100%（上書き・強化ではない）",
      ],
      rate: 100,
    };
  }, [
    own,
    card,
    mode,
    canSkill1,
    canSkill2,
    skill1Lv,
    skill2,
    skill2Card,
    skill2Same,
    skill2Label,
    matCard,
    matLabel,
    matOwn,
  ]);

  const selectBase = (id: string) => {
    setSelected(id);
    setMaterialId(null);
    setLastResult(null);
    setConfirmOpen(false);
  };

  const doFuse = () => {
    if (!focusId) return;
    let result: FuseResult | null = null;
    if (mode === "skill1") {
      result = trainFuse(focusId);
    } else if (materialId) {
      result = trainFuseOther(focusId, materialId);
    }
    setConfirmOpen(false);
    setLastResult(result);
    if (mode === "skill2") setMaterialId(null);
  };

  return (
    <Shell title="合成・育成" extra={<GoldChip gold={gold} />} bg="/bg/palace.jpg" nav="train" wide>
      <div className="flex h-full min-h-0 gap-3">
        {/* Left: base card + stats */}
        <div className="flex w-[300px] shrink-0 flex-col gap-2 overflow-y-auto">
          {card && own ? (
            <>
              <div className="flex gap-2">
                <CardFace card={card} level={own.level} skill1Lv={skill1Lv} size="md" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-sm leading-snug text-fg">{card.name}</p>
                  <p className="text-[10px] text-muted">{card.title}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <TypeBadge type={card.type} />
                    <span className="text-[10px] text-brass">{card.rarity}</span>
                    {card.fodder ? (
                      <span className="rounded-sm bg-crimson/85 px-1 py-0.5 text-[9px] font-semibold text-fg">
                        素材専用
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-muted">
                    所持 <span className="tabular text-fg">{own.count}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-raised/60 p-2 hairline">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="text-faint">TYPE</span>
                    <span className="font-semibold text-fg">{TYPE_LABEL[card.type]}</span>
                  </span>
                  <span className="tabular">
                    <span className="text-faint">Lv </span>
                    <span className="text-fg">
                      {own.level}/{MAX_LEVEL}
                    </span>
                  </span>
                  <span className="tabular">
                    <span className="text-faint">HP </span>
                    <span className="text-fg">{scaledStat(card.hp, own.level)}</span>
                  </span>
                  <span className="tabular text-brass">
                    COST {card.cost}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                  <StatChip label="攻" value={scaledStat(card.atk, own.level)} tone="atk" />
                  <StatChip label="防" value={scaledStat(card.def, own.level)} tone="def" />
                  <StatChip label="速" value={scaledStat(card.spd, own.level)} tone="spd" />
                </div>
              </div>

              {isFodderBase ? (
                <p className="rounded-sm bg-crimson/20 px-1.5 py-1 text-[11px] text-crimson">
                  素材専用 — 金鍛錬・同名合成不可（異名の素材には使える）
                </p>
              ) : lvMax ? (
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

              {form ? (
                <div className="rounded-md bg-raised/40 p-2 text-[10px] hairline">
                  <p className="text-faint">リーダー陣形</p>
                  <p className="font-display text-xs text-fg">{form.name}</p>
                  <p className="text-muted">{form.desc}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">育てるカードがない。</p>
          )}
        </div>

        {/* Center: skills + synth controls */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
          {card && own ? (
            <>
              <SkillSlot
                label="基本技"
                name={BASIC_SKILL.name}
                desc={BASIC_SKILL.desc}
                power={BASIC_SKILL.power}
                tone="basic"
              />
              <SkillSlot
                label="必殺技1"
                name={card.skill.name}
                desc={card.skill.desc}
                power={card.skill.power}
                lv={skill1Lv}
                scaledPower={Math.round(card.skill.power * skillPowerScale(skill1Lv))}
                tone="s1"
              />
              <SkillSlot
                label="必殺技2"
                name={skill2Card ? commonSkillName(skill2Card.skill, skill2Card.rarity) : "-"}
                subName={skill2Card ? skill2Card.skill.name : undefined}
                desc={skill2Card ? skill2Card.skill.desc : "異名カードを合成して装着できる。"}
                power={skill2Card?.skill.power}
                lv={skill2 ? skill2.lv : undefined}
                empty={!skill2}
                scaledPower={
                  skill2Card && skill2
                    ? Math.round(skill2Card.skill.power * skillPowerScale(skill2.lv))
                    : undefined
                }
                tone="s2"
              />

              <div className="flex gap-1.5">
                <ModeChip active={mode === "skill1"} onClick={() => { setMode("skill1"); setMaterialId(null); setLastResult(null); }}>
                  同名合成（必殺1）
                </ModeChip>
                <ModeChip active={mode === "skill2"} onClick={() => { setMode("skill2"); setLastResult(null); }}>
                  異名合成（必殺2）
                </ModeChip>
              </div>

              {mode === "skill1" ? (
                <div className="rounded-md bg-raised/50 p-2 text-[11px] hairline">
                  <p className="text-muted">
                    同じカードを素材にして必殺技1を強化。成功率はレベルが高いほど下がる。
                  </p>
                  <p className="mt-1 tabular text-fg">
                    現在 Lv.{skill1Lv}/{MAX_SKILL_LV}
                    {!skill1Max ? (
                      <span className="ml-2 text-brass">成功率 {fuseSuccessRate(skill1Lv, own.level, own.level)}%</span>
                    ) : (
                      <span className="ml-2 text-brass">MAX</span>
                    )}
                    <span className="ml-2 text-muted">同名所持 {own.count}</span>
                  </p>
                  <button
                    type="button"
                    disabled={!canSkill1}
                    onClick={() => setConfirmOpen(true)}
                    className="mt-2 flex h-9 w-full items-center justify-center rounded-lg bg-surface text-xs hairline disabled:opacity-40"
                  >
                    {skill1Max
                      ? "必殺技1は最大"
                      : canSkill1
                        ? `同名合成（成功率 ${fuseSuccessRate(skill1Lv, own.level, own.level)}%）`
                        : "同名が足りない（2枚以上）"}
                  </button>
                </div>
              ) : (
                <div className="rounded-md bg-raised/50 p-2 text-[11px] hairline">
                  <p className="mb-1.5 text-muted">
                    別カードを素材に必殺技2を装着／強化／上書き。同種・同レアで強化（成功率あり）、レア違い・種別違いは上書き。
                  </p>
                  <div className="mb-2 flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto">
                    {otherMaterials.length === 0 ? (
                      <p className="text-faint">他に所持カードがない。</p>
                    ) : (
                      otherMaterials.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setMaterialId(c.id)}
                          className={cn(
                            "rounded-md p-0.5",
                            materialId === c.id ? "ring-2 ring-brass" : "opacity-80 hover:opacity-100",
                          )}
                        >
                          <CardFace
                            card={c}
                            level={owned[c.id]?.level}
                            skill1Lv={owned[c.id]?.skill1Lv}
                            size="xs"
                          />
                          <p className="mt-0.5 max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-fg">
                            {materialSkillLabel(c.skill, c.rarity)}
                          </p>
                          <p className="text-center text-[9px] tabular text-muted">
                            ×{owned[c.id]?.count ?? 0}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canSkill2}
                    onClick={() => setConfirmOpen(true)}
                    className="flex h-9 w-full items-center justify-center rounded-lg bg-surface text-xs hairline disabled:opacity-40"
                  >
                    {!matCard || !matLabel
                      ? "素材カードを選ぶ"
                      : !skill2
                        ? `「${matLabel}」を必殺2に装着`
                        : skill2Same
                          ? skill2.lv >= MAX_SKILL_LV
                            ? "必殺技2は最大"
                            : `必殺2強化（成功率 ${fuseSuccessRate(skill2.lv, own.level, matOwn?.level ?? 1)}%）`
                          : `必殺2を上書き：${matLabel} Lv.1`}
                  </button>
                </div>
              )}

              {lastResult ? (
                <p
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[11px]",
                    lastResult.success ? "bg-brass/20 text-brass" : "bg-crimson/15 text-crimson",
                  )}
                >
                  {lastResult.message}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Right: base card tray */}
        <div className="flex w-[200px] shrink-0 flex-col sm:w-[220px]">
          <p className="mb-1 text-[10px] text-muted">ベースカード</p>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-1.5 overflow-y-auto content-start">
            {tray.map((c) => (
              <div key={c.id} className="flex flex-col">
                <CardFace
                  card={c}
                  level={owned[c.id]?.level}
                  skill1Lv={owned[c.id]?.skill1Lv}
                  size="xs"
                  selected={focusId === c.id}
                  onClick={() => selectBase(c.id)}
                  className="w-full"
                />
                <p
                  className={cn(
                    "mt-0.5 text-center text-[9px] tabular",
                    (owned[c.id]?.level ?? 1) >= MAX_LEVEL ? "text-brass" : "text-muted",
                  )}
                >
                  ×{owned[c.id]?.count ?? 0}
                  {(owned[c.id]?.skill1Lv ?? 1) > 1
                    ? ` 技${owned[c.id]!.skill1Lv}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmOpen && confirmInfo ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/75 p-3">
          <div className="panel w-full max-w-sm rounded-xl p-4">
            <h3 className="font-display text-base text-fg">{confirmInfo.title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {confirmInfo.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="h-10 flex-1 rounded-lg bg-raised text-sm text-muted"
              >
                やめる
              </button>
              <PrimaryButton onClick={doFuse} className="h-10 flex-1 text-sm">
                合成する
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "atk" | "def" | "spd";
}) {
  const toneClass =
    tone === "atk" ? "text-crimson" : tone === "def" ? "text-sky-300" : "text-emerald-300";
  return (
    <div className="rounded bg-bg/50 py-1">
      <div className={cn("text-faint", toneClass)}>{label}</div>
      <div className="tabular text-fg">{value}</div>
    </div>
  );
}

function ModeChip({
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
      className={cn(
        "h-8 flex-1 rounded-full px-2 text-[11px]",
        active ? "bg-brass text-bg" : "bg-surface text-muted hairline",
      )}
    >
      {children}
    </button>
  );
}

function SkillSlot({
  label,
  name,
  subName,
  desc,
  power,
  lv,
  scaledPower,
  empty,
  tone,
}: {
  label: string;
  name: string;
  /** Optional original card skill name under common name (skill2). */
  subName?: string;
  desc: string;
  power?: number;
  lv?: number;
  scaledPower?: number;
  empty?: boolean;
  tone: "basic" | "s1" | "s2";
}) {
  const bar =
    tone === "s2"
      ? empty
        ? "bg-crimson/25 border-crimson/40"
        : "bg-crimson/15 border-crimson/30"
      : tone === "s1"
        ? "bg-sky-500/10 border-sky-400/25"
        : "bg-raised/50 border-fg/10";
  return (
    <div className={cn("rounded-md border p-2", bar)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-wide text-faint">{label}</p>
        {empty ? (
          <span className="text-[11px] tabular text-crimson">Lv.-</span>
        ) : lv != null ? (
          <span className="text-[11px] tabular text-fg">Lv.{lv}</span>
        ) : null}
      </div>
      <p className={cn("font-display text-sm", empty ? "text-crimson" : "text-fg")}>{name}</p>
      {subName && subName !== name ? (
        <p className="text-[10px] text-faint">{subName}</p>
      ) : null}
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
      {power != null && !empty ? (
        <p className="mt-1 text-[10px] text-brass">
          威力:{scaledPower ?? power}
          {scaledPower != null && scaledPower !== power ? `（基礎 ${power}）` : ""}
        </p>
      ) : null}
    </div>
  );
}
