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
  R: "ring-muted",
  SR: "ring-brass",
  UR: "ring-crimson",
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

export function CardFace({
  card,
  level,
  rank = 0,
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
  rank?: number;
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
    mini: "w-12 aspect-[2/3] text-[8px]",
    xs: "w-[76px] aspect-[2/3] text-[9px]",
    sm: "w-[100px] aspect-[2/3] text-[10px]",
    md: "w-[120px] aspect-[2/3] text-[11px]",
    lg: "w-[160px] aspect-[2/3] text-sm",
  };
  const Tag = onClick ? "button" : "div";
  const shortName = card.name.replace(/^.+の/, "").replace(/^煌龍帝|^鉄騎将軍|^天翔姫|^紅蓮の|^滅刃王|^霊獣王|^征嵐|^金鱗姫/, "");
  const compact = size === "mini" || size === "xs";
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
      <img
        src={factionBg(card)}
        alt=""
        className="card-layer-bg pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <p
        className={cn(
          "card-layer-name pointer-events-none absolute inset-x-0 top-[3%] px-0.5 text-center font-display leading-none",
          compact ? "text-[0.65em]" : "text-[0.85em]",
        )}
      >
        {compact ? shortName : card.name}
      </p>
      {!src ? (
        <Crest card={card} />
      ) : (
        <img
          src={src}
          alt=""
          onError={onError}
          className="card-layer-char pointer-events-none absolute inset-x-0 bottom-[16%] top-[16%] mx-auto w-full object-contain object-bottom"
        />
      )}
      <div className="card-layer-frame pointer-events-none absolute inset-0 rounded-[inherit]" />
      {leader ? (
        <span className="card-leader pointer-events-none absolute inset-x-1 bottom-[18%] z-[4] py-px text-center text-[8px]">
          LEADER
        </span>
      ) : null}
      <div className="card-foot pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-0.5 px-0.5 pb-0.5 pt-3">
        <span
          className={cn(
            "card-hex inline-flex items-center justify-center font-medium",
            compact ? "h-4 w-5 text-[8px]" : "h-5 w-6 text-[9px]",
            TYPE_CLASS[card.type],
          )}
        >
          {TYPE_LABEL[card.type]}
        </span>
        {!compact && level ? (
          <span className="min-w-0 flex-1 truncate text-center text-[8px] text-fg/90 tabular">
            Lv.{lv}
            {rank ? <span className="text-brass">+{rank}</span> : null}
          </span>
        ) : rank ? (
          <span className="min-w-0 flex-1 truncate text-center text-[8px] text-brass tabular">+{rank}</span>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "card-hex inline-flex items-center justify-center bg-card-cost font-medium text-bg tabular",
            compact ? "h-4 w-5 text-[8px]" : "h-5 w-6 text-[9px]",
          )}
        >
          {card.cost}
        </span>
      </div>
      {hp != null && maxHp != null ? (
        <div className="absolute inset-x-0.5 bottom-0 z-[5]">
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
      {src ? (
        <img
          src={src}
          alt={card.name}
          onError={onError}
          className={cn(
            "h-[86%] w-auto max-w-full object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.55)]",
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
  rank = 0,
}: {
  card: Card;
  level?: number;
  rank?: number;
}) {
  const rows = [
    { k: "Lv", v: level },
    { k: "＋", v: rank },
    { k: "HP", v: scaledStat(card.hp, level, rank) },
    { k: "攻", v: scaledStat(card.atk, level, rank) },
    { k: "防", v: scaledStat(card.def, level, rank) },
    { k: "速", v: scaledStat(card.spd, level, rank) },
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
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/70 to-bg/80" />
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
        "relative z-20 flex w-[4.75rem] shrink-0 flex-col bg-ink/95 py-1.5",
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
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs tracking-wide active:bg-raised/60",
            screen === it.id || (screen === "scout" && it.id === "map")
              ? "text-brass"
              : "text-muted",
          )}
        >
          {it.label}
        </button>
      ))}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDebugOpen(true);
        }}
        className="debug-hit flex h-12 shrink-0 items-center justify-center text-[11px] text-faint active:bg-raised/60"
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
