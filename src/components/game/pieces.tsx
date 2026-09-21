import { useEffect, useRef, useState, type ReactNode } from "react";
import { CARD_BY_ID, TYPE_LABEL, scaledStat } from "@/game/data";
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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-[10px] font-medium tracking-wide",
        TYPE_CLASS[type],
        className,
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

export function GoldChip({ gold }: { gold: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-brass hairline tabular">
      <span className="font-display tracking-wider">金</span>
      {gold}
    </span>
  );
}

export function SpiritChip({ spirit, max }: { spirit: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-crimson hairline tabular">
      <span className="font-display tracking-wider">闘気</span>
      {spirit}/{max}
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
    mini: "w-[var(--card-w-mini)] aspect-[2/3] text-[8px]",
    xs: "w-[var(--card-w-xs)] aspect-[2/3] text-[9px]",
    sm: "w-[var(--card-w-sm)] aspect-[2/3] text-[10px]",
    md: "w-[var(--card-w-md)] aspect-[2/3] text-[11px]",
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
      {/* Layer order bottom→top: bg → prism → name → char → foot (type/cost/Lv) */}
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
          compact ? "text-[1.1em]" : "text-[1.4em]",
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
          className="card-layer-char pointer-events-none absolute inset-x-0 bottom-[16%] top-[16%] z-[3] mx-auto w-full object-contain object-bottom"
        />
      )}
      <div className="card-layer-frame pointer-events-none absolute inset-0 z-[3] rounded-[inherit]" />
      {leader ? (
        <span className="card-leader pointer-events-none absolute inset-x-1 bottom-[18%] z-[4] py-px text-center text-[8px]">
          LEADER
        </span>
      ) : null}
      {card.fodder ? (
        <span
          className={cn(
            "pointer-events-none absolute right-[2%] top-[14%] z-[4] rounded-sm bg-crimson/90 px-1 font-semibold leading-none text-fg",
            compact ? "py-px text-[7px]" : "py-0.5 text-[8px]",
          )}
        >
          素材
        </span>
      ) : null}
      <div className="card-foot pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex items-end justify-between gap-1 px-[2%] pb-[2.5%] pt-4">
        <span
          className={cn(
            "card-hex card-type-badge inline-flex shrink-0 items-center justify-center font-semibold leading-none",
            compact ? "h-[2em] w-[2.2em] text-[1.2em]" : "h-[2.2em] w-[2.45em] text-[1.35em]",
            TYPE_CLASS[card.type],
          )}
        >
          {TYPE_LABEL[card.type]}
        </span>
        {!compact && level ? (
          <span className="card-text-outline min-w-0 flex-1 truncate text-center text-[0.9em] tabular">
            Lv.{lv}
            {skill1Lv > 1 ? <span className="text-brass"> 技{skill1Lv}</span> : null}
          </span>
        ) : skill1Lv > 1 ? (
          <span className="card-text-outline min-w-0 flex-1 truncate text-center text-[0.9em] text-brass tabular">
            技Lv.{skill1Lv}
          </span>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "card-hex card-cost-num inline-flex shrink-0 items-center justify-center bg-ink/75 font-semibold leading-none tabular",
            compact ? "h-[2em] w-[2.2em] text-[1.2em]" : "h-[2.2em] w-[2.45em] text-[1.35em]",
          )}
        >
          {card.cost}
        </span>
      </div>
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
  const card = id ? CARD_BY_ID[id] : null;
  if (!card) return null;
  const src = charSrc(card);
  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center bg-bg/80 p-3"
      onPointerDown={() => setZoomCard(null)}
    >
      <div
        className="flex h-[94%] max-w-[42%] flex-col items-center"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {src ? (
          <img src={src} alt={card.name} className="min-h-0 w-auto flex-1 object-contain" />
        ) : (
          <Crest card={card} />
        )}
        <p className="mt-1 shrink-0 font-display text-sm text-fg">{card.name}</p>
      </div>
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
  float?: { text: string; crit: boolean; key: number } | null;
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
      {hp != null && maxHp != null ? (
        <div className="absolute left-1/2 top-0 z-[3] w-[72%] -translate-x-1/2">
          <HpBar hp={hp} max={maxHp} />
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
      {float ? (
        <span
          key={float.key}
          className={cn(
            "anim-float pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 font-display text-sm tabular",
            float.crit ? "text-brass" : float.text.startsWith("+") ? "text-ok" : "text-fg",
          )}
        >
          {float.text}
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

export function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const low = pct < 30;
  return (
    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-bg/80">
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
    <dl className="flex flex-col gap-0.5 text-[11px]">
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
  const navSide = useGame((s) => s.navSide);
  const sideNav = nav ? <SideNav screen={nav} side={navSide} /> : null;
  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden text-fg">
      {bg ? (
        <img
          src={bg}
          alt=""
          crossOrigin="anonymous"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/50 via-bg/30 to-bg/50" />
      {navSide === "left" ? sideNav : null}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col px-3 py-2">
        <header className="mb-2 flex h-9 shrink-0 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 min-w-9 items-center justify-center rounded-md bg-surface hairline text-xs"
            >
              戻る
            </button>
          ) : null}
          <h1 className="font-display text-lg tracking-wide">{title}</h1>
          <div className="ml-auto flex items-center gap-2">{extra}</div>
        </header>
        <div className={cn("min-h-0 min-w-0 flex-1", wide ? "overflow-hidden" : "overflow-auto")}>
          {children}
        </div>
      </div>
      {navSide === "right" ? sideNav : null}
    </div>
  );
}

export function SideNav({ screen, side = "right" }: { screen: string; side?: "left" | "right" }) {
  const setScreen = useGame((s) => s.setScreen);
  const setDebugOpen = useGame((s) => s.setDebugOpen);
  const items = [
    { id: "map" as const, label: "出陣" },
    { id: "formation" as const, label: "編成" },
    { id: "palace" as const, label: "本拠" },
    { id: "train" as const, label: "育成" },
    { id: "collection" as const, label: "図鑑" },
    { id: "summon" as const, label: "召喚" },
  ];
  const edgePad =
    side === "left"
      ? "pl-[max(0.25rem,env(safe-area-inset-left,0px))]"
      : "pr-[max(0.25rem,env(safe-area-inset-right,0px))]";
  return (
    <nav
      className={cn(
        "relative z-20 flex w-[4.75rem] shrink-0 flex-col bg-ink/95 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]",
        edgePad,
        side === "left" ? "border-r border-border order-first" : "border-l border-border",
      )}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => setScreen(it.id)}
          className={cn(
            "flex min-h-10 flex-1 flex-col items-center justify-center px-0.5 text-[11px] leading-none tracking-wide whitespace-nowrap active:bg-raised/60",
            screen === it.id || (screen === "scout" && it.id === "map")
              ? "text-brass"
              : "text-muted",
          )}
        >
          <span className="block whitespace-nowrap">{it.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDebugOpen(true);
        }}
        className="debug-hit flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap text-[11px] leading-none text-faint active:bg-raised/60"
      >
        内部
      </button>
    </nav>
  );
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
        "rounded-md bg-brass px-4 font-medium text-bg disabled:opacity-40",
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
      className={cn("rounded-md bg-raised px-4 text-fg hairline", className)}
    >
      {children}
    </button>
  );
}
