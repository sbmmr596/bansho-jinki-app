import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  CARD_BY_ID,
  cardBasicSkill,
  FORMATIONS,
  MAX_LEVEL,
  TYPE_LABEL,
  scaledStat,
  skillPowerScale,
} from "@/game/data";
import { commonSkillName } from "@/game/skillNames";
import { useGame } from "@/game/store";
import type { Card, ElementType, Rarity, Screen } from "@/game/types";
import { cn } from "@/lib/utils";

const TYPE_CLASS: Record<ElementType, string> = {
  power: "bg-type-power text-fg",
  skill: "bg-type-skill text-bg",
  magic: "bg-type-magic text-fg",
  void: "bg-type-void text-bg",
  heaven: "bg-type-heaven text-bg",
  earth: "bg-type-earth text-bg",
};

const RARITY_RING: Record<Rarity, string> = {
  N: "ring-faint",
  S: "ring-muted",
  H: "ring-brass",
  SP: "ring-crimson",
};

const SPRITES = new Set([
  "kaien",
  "azuha",
  "claire",
  "gouzan",
  "ryuji",
  "bold",
  "haru",
  "kuro",
  "leo",
  "hito",
  "rin",
  "mirei",
  "sora",
  "iva",
  "maki",
  "saika",
  "daruk",
  "zanma",
  "fenrir",
  "yuki",
  "kon",
  "nox",
  "mizuki",
  "vel",
  "z_power",
  "z_skill",
  "z_magic",
  "z_void",
  "z_heaven",
  "z_earth",
]);

export function charSrc(card: Card, bust = false) {
  if (bust) return card.bust || `/cards/${card.id}.jpg`;
  if (card.art) {
    const s = card.art;
    if (s.startsWith("/chars/") && !s.includes("?")) return `${s}?v=k4`;
    return s;
  }
  const id = card.portrait ?? card.id;
  return SPRITES.has(id) ? `/chars/${id}.png?v=k4` : `/cards/${id}.jpg`;
}

function cardFallbackSrc(card: Card) {
  return card.bust || `/cards/${card.id}.jpg`;
}

function useCardImg(card: Card, bust = false) {
  const primary = card.portrait ? charSrc(card, bust) : "";
  const fallback = cardFallbackSrc(card);
  const [src, setSrc] = useState(primary);
  useEffect(() => {
    setSrc(primary);
  }, [primary]);
  const onError = () => {
    if (!src) return;
    if (src !== fallback) setSrc(fallback);
    else setSrc("");
  };
  return { src, onError };
}

export function factionBg(card: Card) {
  return `/factions/${card.faction}.svg`;
}

export function TypeBadge({ type, className }: { type: ElementType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5 text-[12px] font-semibold tracking-wide",
        TYPE_CLASS[type],
        className,
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

/** Hexagonal TYPE chip matching on-card `.card-hex` styling (for off-card UIs). */
export function TypeHex({ type, className }: { type: ElementType; className?: string }) {
  return (
    <span
      className={cn(
        "card-hex card-type-badge inline-flex h-[2.35em] w-[2.55em] shrink-0 items-center justify-center text-[1.4em] font-semibold leading-none",
        TYPE_CLASS[type],
        className,
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

/** Hexagonal COST chip matching on-card `.card-hex` styling (for off-card UIs). */
export function CostHex({ cost, className }: { cost: number; className?: string }) {
  return (
    <span
      className={cn(
        "card-hex card-cost-num inline-flex h-[2.35em] w-[2.55em] shrink-0 items-center justify-center bg-ink/75 text-[1.4em] font-semibold leading-none tabular",
        className,
      )}
    >
      {cost}
    </span>
  );
}

export function GoldChip({ gold }: { gold: number }) {
  return (
    <span className="inline-flex h-12 min-h-12 items-center gap-1.5 rounded-md bg-raised px-3 text-sm text-brass hairline tabular">
      <span className="font-display tracking-wider">金</span>
      {gold}
    </span>
  );
}

export function SpiritChip({ spirit, max }: { spirit: number; max: number }) {
  const filled = Math.max(0, Math.min(max, Math.floor(spirit)));
  return (
    <span
      className="inline-flex h-12 min-h-12 items-center gap-2 rounded-md bg-raised px-3 text-sm hairline"
      role="img"
      aria-label={`闘気 ${filled}/${max}`}
    >
      <span className="font-display tracking-wider text-crimson">闘気</span>
      <span className="inline-flex items-center gap-1" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-3 w-3 rounded-full",
              i < filled
                ? "bg-brass shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-fg)_20%,transparent)]"
                : "bg-crimson/55 ring-1 ring-crimson/35",
            )}
          />
        ))}
      </span>
    </span>
  );
}

export function CardFace({
  card,
  level,
  skill1Lv = 1,
  size = "sm",
  selected,
  dimmed,
  leader,
  acting,
  struck,
  hp,
  maxHp,
  onClick,
  className,
}: {
  card: Card;
  level?: number;
  /** 必殺技1 level — shown as 技Lv.N when > 1 */
  skill1Lv?: number;
  size?: "mini" | "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  dimmed?: boolean;
  leader?: boolean;
  acting?: boolean;
  struck?: boolean;
  hp?: number;
  maxHp?: number;
  onClick?: () => void;
  className?: string;
}) {
  const { src, onError } = useCardImg(card);
  const setZoomCard = useGame((s) => s.setZoomCard);
  const hold = useRef(0);
  const held = useRef(false);
  const sizes = {
    mini: "w-[var(--card-w-mini)] aspect-[2/3] text-[10px]",
    xs: "w-[var(--card-w-xs)] aspect-[2/3] text-[11px]",
    sm: "w-[var(--card-w-sm)] aspect-[2/3] text-[12px]",
    md: "w-[var(--card-w-md)] aspect-[2/3] text-[13px]",
    lg: "w-[var(--card-w-lg)] aspect-[2/3] text-sm",
  };
  const Tag = onClick ? "button" : "div";
  const shortName = card.name.replace(/^.+の/, "").replace(/^煌龍帝|^鉄騎将軍|^天翔姫|^紅蓮の|^滅刃王|^霊獣王|^征嵐|^金鱗姫/, "");
  const compact = size === "mini" || size === "xs";
  const nameLabel = compact ? shortName : card.name;
  const nameChars = Array.from(nameLabel);
  const lv = level ?? 1;
  const clearHold = () => window.clearTimeout(hold.current);
  const startHold = () => {
    held.current = false;
    clearHold();
    hold.current = window.setTimeout(() => {
      held.current = true;
      setZoomCard(card.id);
    }, 420);
  };
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onPointerDown={startHold}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (held.current) {
          e.preventDefault();
          e.stopPropagation();
          held.current = false;
          return;
        }
        onClick?.();
      }}
      className={cn(
        "card-face relative overflow-hidden text-left ring-1 transition-transform duration-150",
        sizes[size],
        RARITY_RING[card.rarity],
        selected && "ring-2 ring-brass scale-[1.03]",
        dimmed && "opacity-40",
        acting && "anim-act",
        struck && "anim-struck",
        onClick && "hover:brightness-110 active:scale-[0.98]",
        className,
      )}
    >
      {/* Layer order bottom→top: bg → prism → name → char → foot (Lv only; type/cost off-card) */}
      <img
        src={factionBg(card)}
        alt=""
        className="card-layer-bg pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
      />
      {card.rarity !== "N" ? (
        <span
          aria-hidden
          className={cn("card-prism pointer-events-none absolute inset-0 z-[1]", `card-prism-${card.rarity.toLowerCase()}`)}
        />
      ) : null}
      <p
        className={cn(
          "card-layer-name pointer-events-none absolute inset-x-[1%] top-[1.5%] z-[2] flex w-[98%] items-center gap-0 leading-none",
          nameChars.length <= 2 ? "justify-center" : "justify-between",
          compact ? "text-[1.15em]" : "text-[1.45em]",
        )}
        aria-label={nameLabel}
      >
        {nameChars.map((ch, i) => (
          <span key={`${ch}-${i}`} className="shrink-0">
            {ch === " " ? " " : ch}
          </span>
        ))}
      </p>
      {!src ? (
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <Crest card={card} />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          onError={onError}
          className="card-layer-char pointer-events-none absolute inset-x-0 bottom-[4%] top-[16%] z-[3] mx-auto w-full object-contain object-bottom"
        />
      )}
      <div className="card-layer-frame pointer-events-none absolute inset-0 z-[3] rounded-[inherit]" />
      {leader ? (
        <span className="card-leader pointer-events-none absolute inset-x-1 bottom-[18%] z-[4] py-px text-center text-[10px] font-semibold tracking-wide">
          LEADER
        </span>
      ) : null}
      {card.fodder ? (
        <span
          className={cn(
            "pointer-events-none absolute right-[2%] top-[14%] z-[4] rounded-sm bg-crimson/90 px-1 font-semibold leading-none text-fg",
            compact ? "py-px text-[9px]" : "py-0.5 text-[10px]",
          )}
        >
          素材
        </span>
      ) : null}
      {/* TYPE/COST are always off-card (TypeHex/CostHex); keep Lv/技Lv on-face only. */}
      {!compact && level ? (
        <div className="card-foot pointer-events-none absolute inset-x-0 bottom-0 z-[5] px-[2%] pb-[2%] pt-3 text-center">
          <span className="card-text-outline text-[0.9em] tabular">
            Lv.{lv}
            {skill1Lv > 1 ? <span className="text-brass"> 技{skill1Lv}</span> : null}
          </span>
        </div>
      ) : skill1Lv > 1 ? (
        <div className="card-foot pointer-events-none absolute inset-x-0 bottom-0 z-[5] px-[2%] pb-[2%] pt-3 text-center">
          <span className="card-text-outline text-[0.9em] text-brass tabular">技Lv.{skill1Lv}</span>
        </div>
      ) : null}
      {hp != null && maxHp != null ? (
        <div className="absolute inset-x-0.5 bottom-0 z-[6]">
          <HpBar hp={hp} max={maxHp} />
        </div>
      ) : null}
    </Tag>
  );
}

export function ArtZoom() {
  const id = useGame((s) => s.zoomCardId);
  const setZoomCard = useGame((s) => s.setZoomCard);
  const owned = useGame((s) => s.owned);
  const card = id ? CARD_BY_ID[id] : null;
  if (!card) return null;

  const own = owned[card.id];
  const level = own?.level ?? 1;
  const skill1Lv = own?.skill1Lv ?? 1;
  const skill2 = own?.skill2;
  const skill2Card = skill2 ? CARD_BY_ID[skill2.sourceCardId] : null;
  const form = FORMATIONS[card.formation];

  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center bg-bg/80 p-1.5 @sm:p-2"
      onPointerDown={() => setZoomCard(null)}
    >
      <div
        className="panel relative grid h-full max-h-full w-full max-w-4xl grid-cols-2 gap-2 overflow-hidden rounded-xl p-2 @sm:gap-3 @sm:p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <CloseButton
          onClick={() => setZoomCard(null)}
          className="absolute right-1 top-1 z-10"
        />

        {/* Left: large card art fills column; TYPE|Lv·HP|COST + 攻防速 stuck under */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <CardFace
              card={card}
              size="lg"
              className="!h-full !w-auto max-h-full max-w-full"
            />
          </div>

          {/* カード外フッタ帯: TypeHex | Lv·HP | CostHex、その下に攻防速 */}
          <div className="shrink-0 rounded-md bg-raised/60 p-2 hairline">
            <div className="mb-1.5 grid grid-cols-3 items-center gap-x-2 gap-y-1 text-[12px]">
              <span className="flex items-center justify-start gap-1">
                <span className="text-faint">TYPE</span>
                <TypeHex type={card.type} className="h-7 w-8 text-sm" />
              </span>
              <span className="flex flex-wrap items-center justify-center gap-x-2 tabular">
                <span>
                  <span className="text-faint">Lv </span>
                  <span className="text-fg">
                    {level}/{MAX_LEVEL}
                  </span>
                </span>
                <span>
                  <span className="text-faint">HP </span>
                  <span className="text-fg">{scaledStat(card.hp, level)}</span>
                </span>
              </span>
              <span className="flex items-center justify-end gap-1 tabular">
                <span className="text-faint">COST</span>
                <CostHex cost={card.cost} className="h-7 w-8 text-sm" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[12px]">
              <ZoomStatChip label="攻" value={scaledStat(card.atk, level)} tone="atk" />
              <ZoomStatChip label="防" value={scaledStat(card.def, level)} tone="def" />
              <ZoomStatChip label="速" value={scaledStat(card.spd, level)} tone="spd" />
            </div>
          </div>
        </div>

        {/* Right: name → formation → skills fill remaining height */}
        <div className="flex min-h-0 flex-col gap-2 pr-8 @sm:pr-10">
          <div className="shrink-0 space-y-0.5">
            <p className="font-display text-base leading-snug text-fg @sm:text-lg">{card.name}</p>
            <p className="text-[12px] text-muted">{card.title}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-brass">{card.rarity}</span>
              {card.fodder ? (
                <span className="rounded-sm bg-crimson/85 px-1 py-0.5 text-[11px] font-semibold text-fg">
                  素材専用
                </span>
              ) : null}
              {own ? (
                <span className="text-[12px] text-muted">
                  所持 <span className="tabular text-fg">{own.count}</span>
                </span>
              ) : (
                <span className="text-[12px] text-faint">未所持</span>
              )}
            </div>
          </div>

          {form && !card.fodder ? (
            <div className="flex shrink-0 items-start gap-2 rounded-md bg-raised/40 p-2 text-[12px] hairline">
              <div className="min-w-0 flex-1">
                <p className="text-faint">リーダー陣形</p>
                <p className="font-display text-xs text-fg">{form.name}</p>
                <p className="text-muted">{form.desc}</p>
              </div>
              <ZoomFormationPreview slots={form.slots} />
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <SkillSlot
              label="基本技"
              name={cardBasicSkill(card).name}
              desc={cardBasicSkill(card).desc}
              power={cardBasicSkill(card).power}
              tone="basic"
              className="flex-1"
            />
            <SkillSlot
              label="必殺技1"
              name={card.skill.name}
              desc={card.skill.desc}
              power={card.skill.power}
              lv={skill1Lv}
              scaledPower={Math.round(card.skill.power * skillPowerScale(skill1Lv))}
              tone="s1"
              className="flex-1"
            />
            <SkillSlot
              label="必殺技2"
              name={skill2Card ? commonSkillName(skill2Card.skill, skill2Card.rarity) : "-"}
              subName={skill2Card ? skill2Card.skill.name : undefined}
              desc={skill2Card ? skill2Card.skill.desc : "未装着"}
              power={skill2Card?.skill.power}
              lv={skill2 ? skill2.lv : undefined}
              empty={!skill2}
              scaledPower={
                skill2Card && skill2
                  ? Math.round(skill2Card.skill.power * skillPowerScale(skill2.lv))
                  : undefined
              }
              tone="s2"
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoomStatChip({
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

function ZoomFormationPreview({ slots }: { slots: boolean[] }) {
  return (
    <div className="grid h-14 w-14 shrink-0 grid-cols-3 grid-rows-3 gap-0.5" aria-hidden>
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

/** Shared skill panel used by 育成 and ArtZoom long-press. */
export function SkillSlot({
  label,
  name,
  subName,
  desc,
  power,
  lv,
  scaledPower,
  empty,
  tone,
  className,
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
  className?: string;
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
    <div className={cn("rounded-md border p-2", bar, className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium tracking-wide text-muted">{label}</p>
        {empty ? (
          <span className="text-[13px] tabular text-crimson">Lv.-</span>
        ) : lv != null ? (
          <span className="text-[13px] tabular text-fg">Lv.{lv}</span>
        ) : null}
      </div>
      <p className={cn("font-display text-sm", empty ? "text-crimson" : "text-fg")}>{name}</p>
      {subName && subName !== name ? (
        <p className="text-[12px] text-faint">{subName}</p>
      ) : null}
      <p className="mt-0.5 text-[13px] leading-snug text-muted">{desc}</p>
      {power != null && !empty ? (
        <p className="mt-1 text-[12px] text-brass">
          威力:{scaledPower ?? power}
          {scaledPower != null && scaledPower !== power ? `（基礎 ${power}）` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function CharSprite({
  card,
  acting,
  struck,
  dimmed,
  hp,
  maxHp,
  float,
  flip,
  bust,
}: {
  card: Card;
  acting?: boolean;
  struck?: boolean;
  dimmed?: boolean;
  hp?: number;
  maxHp?: number;
  float?: {
    text: string;
    kind: "damage" | "heal";
    affinity: "クリティカル" | "ガード" | null;
    key: number;
  } | null;
  flip?: boolean;
  bust?: boolean;
}) {
  const { src, onError } = useCardImg(card, bust);
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-end",
        acting && "anim-act",
        struck && "anim-struck",
        dimmed && "opacity-35 grayscale",
      )}
    >
      {float ? (
        <span
          key={`num-${float.key}`}
          className={cn(
            "battle-float-num anim-float pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 tabular",
            float.kind === "heal" ? "is-heal" : "is-dmg",
          )}
        >
          {float.text}
        </span>
      ) : null}
      {hp != null && maxHp != null ? (
        <div className="absolute left-1/2 top-0 z-[3] w-[72%] -translate-x-1/2">
          <HpBar hp={hp} max={maxHp} thick />
        </div>
      ) : null}
      <span
        className={cn(
          "unit-foot-shadow pointer-events-none absolute bottom-[1%] left-1/2 z-0 -translate-x-1/2 rounded-[50%]",
          dimmed && "opacity-40",
        )}
        aria-hidden
      />
      {src ? (
        <img
          src={src}
          alt={card.name}
          onError={onError}
          className={cn(
            "relative z-[1] h-[86%] w-auto max-w-full object-contain",
            flip && "-scale-x-100",
          )}
        />
      ) : (
        <Crest card={card} />
      )}
      {float?.affinity ? (
        <span
          key={`aff-${float.key}`}
          className={cn(
            "battle-affinity pointer-events-none absolute left-1/2 top-[44%] z-[5]",
            float.affinity === "クリティカル" ? "is-crit" : "is-guard",
          )}
        >
          {float.affinity}
        </span>
      ) : null}
    </div>
  );
}

function Crest({ card }: { card: Card }) {
  const ch = card.name.charAt(0);
  return (
    <div
      className="card-layer-char absolute inset-0 flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--color-faction-${card.faction}) 35%, var(--color-ink)), var(--color-bg))`,
      }}
    >
      <span className="font-display text-4xl text-fg/80">{ch}</span>
    </div>
  );
}

export function HpBar({ hp, max, thick }: { hp: number; max: number; thick?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const low = pct < 30;
  return (
    <div
      className={cn(
        "mt-0.5 w-full overflow-hidden rounded-full bg-bg/80",
        thick ? "h-1.5" : "h-1",
      )}
    >
      <div
        className={cn("h-full rounded-full", low ? "bg-crimson" : "bg-ok")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatRow({
  card,
  level = 1,
  skill1Lv = 1,
}: {
  card: Card;
  level?: number;
  skill1Lv?: number;
}) {
  const rows = [
    { k: "Lv", v: level },
    { k: "技", v: skill1Lv },
    { k: "HP", v: scaledStat(card.hp, level) },
    { k: "攻", v: scaledStat(card.atk, level) },
    { k: "防", v: scaledStat(card.def, level) },
    { k: "速", v: scaledStat(card.spd, level) },
  ];
  return (
    <dl className="flex flex-col gap-0.5 text-[13px]">
      {rows.map((r) => (
        <div key={r.k} className="flex items-center gap-1.5">
          <dt className="w-5 shrink-0 text-muted">{r.k}</dt>
          <dd className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-sm bg-raised">
              <div
                className="h-full bg-brass/80"
                style={{ width: `${Math.min(100, r.k === "Lv" ? (r.v / 10) * 100 : r.v / 20)}%` }}
              />
            </div>
          </dd>
          <dd className="w-9 shrink-0 text-right tabular text-fg">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Shell({
  title,
  onBack,
  extra,
  children,
  bg,
  nav,
  wide,
}: {
  title: string;
  onBack?: () => void;
  extra?: ReactNode;
  children: ReactNode;
  bg?: string;
  nav?: Screen;
  wide?: boolean;
}) {
  const setDebugOpen = useGame((s) => s.setDebugOpen);
  const setHelp = useGame((s) => s.setHelp);
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-fg">
      {bg ? (
        <img
          src={bg}
          alt=""
          crossOrigin="anonymous"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/50 via-bg/30 to-bg/50" />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-border bg-ink/90 px-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-14 min-h-14 min-w-14 items-center justify-center rounded-md bg-surface px-3 hairline text-base"
            >
              戻る
            </button>
          ) : null}
          <h1 className="font-display text-2xl tracking-wide">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {extra}
            {nav ? (
              <>
                <button
                  type="button"
                  onClick={() => setHelp(true)}
                  className="inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-surface px-4 text-base text-muted hairline active:bg-raised/60"
                >
                  遊び方
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDebugOpen(true);
                  }}
                  className="debug-hit inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-surface px-4 text-base text-muted hairline active:bg-raised/60"
                >
                  内部
                </button>
              </>
            ) : null}
          </div>
        </header>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 px-3 pt-1",
            wide ? "overflow-hidden" : "overflow-auto",
          )}
        >
          {children}
        </div>
        {nav ? <BottomNav screen={nav} /> : null}
      </div>
    </div>
  );
}

/** Primary destinations — bottom chrome (原作寄り: 上下振り分け、横長プレイ領域). */
export function BottomNav({ screen }: { screen: string }) {
  const setScreen = useGame((s) => s.setScreen);
  const items = [
    { id: "map" as const, label: "出陣" },
    { id: "formation" as const, label: "編成" },
    { id: "palace" as const, label: "本拠" },
    { id: "train" as const, label: "育成" },
    { id: "collection" as const, label: "図鑑" },
    { id: "summon" as const, label: "召喚" },
  ];
  return (
    <nav
      className="relative z-20 flex h-20 shrink-0 items-stretch gap-0.5 border-t border-border bg-ink/95 px-0.5 pt-0.5 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      aria-label="メインメニュー"
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => setScreen(it.id)}
          className={cn(
            "flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center px-1 text-base font-semibold leading-none tracking-wide whitespace-nowrap active:bg-raised/60",
            screen === it.id || (screen === "scout" && it.id === "map")
              ? "text-brass"
              : "text-muted",
          )}
        >
          <span className="block whitespace-nowrap">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** @deprecated Use BottomNav — kept as alias for any stray imports. */
export function SideNav({ screen }: { screen: string; side?: "left" | "right" }) {
  return <BottomNav screen={screen} />;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-brass px-5 text-base font-medium text-bg disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-raised px-5 text-base text-fg hairline",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Circular × dismiss control — 44px touch, ~32px visual. */
export function CloseButton({
  onClick,
  className,
  label = "閉じる",
}: {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:text-fg active:bg-raised/50",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-base leading-none hairline"
      >
        ×
      </span>
    </button>
  );
}
