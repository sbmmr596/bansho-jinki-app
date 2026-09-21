import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/audio";
import { CARD_BY_ID, NODE_BY_ID } from "@/game/data";
import { ATB_PER_SEC, atbRate, advanceGauges, GAUGE_MAX, modLabel } from "@/game/combat";
import { activeTrial, pumpTrial } from "@/game/trial";
import { useGame } from "@/game/store";
import type { BattleEvent, ElementType, FieldKind, Side, SkillKind, Unit } from "@/game/types";
import { nextBattleSpeed } from "@/game/types";
import { CharSprite, charSrc } from "./pieces";
import { AffinityDiagram } from "./AffinityDiagram";
import { cn } from "@/lib/utils";

const DUR: Record<BattleEvent["kind"], number> = {
  round: 280,
  skill: 720,
  hit: 420,
  heal: 480,
  ko: 280,
  shift: 240,
  spawn: 300,
  buff: 700,
  end: 900,
};

const TYPE_FX: Record<ElementType, string> = {
  power: "#ff8a72",
  skill: "#8ee4ff",
  magic: "#d2b0ff",
  void: "#f2eee6",
  heaven: "#fff3c0",
  earth: "#b4e08c",
};

const FIELD_SRC: Record<FieldKind, string> = {
  grass: "/bg/grass.jpg",
  snow: "/bg/snow.jpg",
  magma: "/bg/magma.jpg",
  forest: "/bg/forest.jpg",
  waste: "/bg/field.jpg",
};

const FIELD_LABEL: Record<FieldKind, string> = {
  grass: "草原",
  snow: "雪原",
  magma: "岩漿",
  forest: "森林",
  waste: "荒野",
};

type SkillFxState = {
  key: number;
  kind: SkillKind;
  type: ElementType;
  targetSide: Side;
  slots: number[];
  actorSlot: number;
  actorSide: Side;
};

type Lunge = { uid: string; x: number; y: number };

export function BattleView() {
  const battle = useGame((s) => s.battle);
  const finishBattle = useGame((s) => s.finishBattle);
  const endTrial = useGame((s) => s.endTrial);
  const addTrialKills = useGame((s) => s.addTrialKills);
  const trial = useGame((s) => s.trial);
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const [units, setUnits] = useState<Unit[]>(() => battle?.units.map((u) => ({ ...u })) ?? []);
  const [float, setFloat] = useState<{ uid: string; text: string; crit: boolean; key: number } | null>(
    null,
  );
  const [acting, setActing] = useState<string | null>(null);
  const [struck, setStruck] = useState<string | null>(null);
  const [fx, setFx] = useState<SkillFxState | null>(null);
  const [lunge, setLunge] = useState<Lunge | null>(null);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showAffinity, setShowAffinity] = useState(false);
  const [skillBanner, setSkillBanner] = useState<{ name: string; key: number; slot: "s1" | "s2" } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const battleSpeed = useGame((s) => s.battleSpeed) || 1;
  const setBattleSpeed = useGame((s) => s.setBattleSpeed);
  const speedRef = useRef(battleSpeed);
  speedRef.current = battleSpeed;
  const trialRef = useRef(trial);
  trialRef.current = trial;
  const addKillsRef = useRef(addTrialKills);
  addKillsRef.current = addTrialKills;
  const skipRef = useRef(false);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const eventsRef = useRef<BattleEvent[]>([]);
  const lastEndRef = useRef<Extract<BattleEvent, { kind: "end" }> | null>(null);
  const gaugeTickRef = useRef(0);
  const actingRef = useRef<string | null>(null);
  const unitsRef = useRef(units);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  useEffect(() => {
    if (!battle) return;
    setUnits(battle.units.map((u) => ({ ...u })));
    setFloat(null);
    setActing(null);
    setStruck(null);
    setFx(null);
    setLunge(null);
    setShake(false);
    setFlash(false);
    setLog([]);
    setSkillBanner(null);
    if (bannerTimerRef.current != null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    idxRef.current = 0;
    accRef.current = 0;
    lastRef.current = 0;
    skipRef.current = false;
    lastEndRef.current = null;
    gaugeTickRef.current = 0;
    eventsRef.current = battle.events.slice();
    let raf = 0;
    const stepEvent = (ev: BattleEvent) => {
      if (ev.kind === "round") {
        setLog((l) => [`第${ev.n}合`, ...l].slice(0, 6));
        setFx(null);
        setStruck(null);
        setLunge(null);
        setActing(null);
      } else if (ev.kind === "skill") {
        const prevAct = actingRef.current;
        actingRef.current = ev.actorUid;
        setActing(ev.actorUid);
        const live = activeTrial();
        if (live) {
          setUnits((prev) =>
            prev.map((u) => {
              if (u.uid === ev.actorUid) return { ...u, gauge: GAUGE_MAX };
              if (u.uid === prevAct) return { ...u, gauge: 0 };
              const lu = live.units.find((x) => x.uid === u.uid);
              return lu ? { ...u, haste: lu.haste } : u;
            }),
          );
        } else {
          setUnits((prev) =>
            prev.map((u) =>
              u.uid === ev.actorUid ? { ...u, gauge: GAUGE_MAX } : u.uid === prevAct ? { ...u, gauge: 0 } : u,
            ),
          );
        }
        const u = unitsRef.current.find((x) => x.uid === ev.actorUid);
        setLog((l) => [`${u?.name ?? ""}　${ev.skillName}`, ...l].slice(0, 6));
        // Center banner only for specials (必殺技1/2); skip 通常攻撃 / basic
        const specialSlot = ev.slot === "s1" || ev.slot === "s2" ? ev.slot : null;
        if (bannerTimerRef.current != null) {
          window.clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = null;
        }
        if (specialSlot) {
          setSkillBanner({ name: ev.skillName, key: idxRef.current, slot: specialSlot });
          bannerTimerRef.current = window.setTimeout(() => {
            setSkillBanner(null);
            bannerTimerRef.current = null;
          }, 1100);
        } else {
          setSkillBanner(null);
        }
        if (u) {
          const slots: number[] = [];
          let targetSide: Side =
            u.skill.kind === "heal" || u.skill.kind === "haste"
              ? u.side
              : u.side === "player"
                ? "enemy"
                : "player";
          for (let i = idxRef.current + 1; i < eventsRef.current.length; i++) {
            const ne = eventsRef.current[i];
            if (ne.kind === "hit" || ne.kind === "heal") {
              const tu =
                unitsRef.current.find((x) => x.uid === ne.targetUid) ??
                activeTrial()?.units.find((x) => x.uid === ne.targetUid);
              if (tu && (u.skill.kind === "heal" || tu.side !== u.side)) {
                slots.push(tu.slot);
                targetSide = tu.side;
              }
            } else if (ne.kind === "buff") {
              const side = u.skill.kind === "haste" ? u.side : targetSide;
              for (const tu of unitsRef.current) {
                if (tu.alive && tu.side === side) slots.push(tu.slot);
              }
            } else if (ne.kind === "ko") continue;
            else break;
          }
          setFx({
            key: idxRef.current,
            kind: u.skill.kind,
            type: u.type,
            targetSide,
            slots,
            actorSlot: u.slot,
            actorSide: u.side,
          });
          const dest = lungePos(u, slots, targetSide);
          setLunge({ uid: u.uid, x: dest.x, y: dest.y });
        }
      } else if (ev.kind === "hit") {
        setUnits((prev) =>
          prev.map((u) => (u.uid === ev.targetUid ? { ...u, hp: ev.hpAfter } : u)),
        );
        const label = modLabel(ev.mod);
        setFloat({
          uid: ev.targetUid,
          text: label ? `${label} ${ev.damage}` : String(ev.damage),
          crit: ev.mod >= 1.2,
          key: ev.targetUid.length + ev.damage + idxRef.current,
        });
        setStruck(ev.targetUid);
        if (ev.mod >= 1.45) {
          sfx("crit");
          setShake(true);
          setFlash(true);
          window.setTimeout(() => setShake(false), 180);
          window.setTimeout(() => setFlash(false), 160);
        } else sfx("hit");
      } else if (ev.kind === "heal") {
        setUnits((prev) =>
          prev.map((u) => (u.uid === ev.targetUid ? { ...u, hp: ev.hpAfter } : u)),
        );
        setFloat({
          uid: ev.targetUid,
          text: `+${ev.amount}`,
          crit: false,
          key: idxRef.current,
        });
        setStruck(ev.targetUid);
        sfx("heal");
      } else if (ev.kind === "buff") {
        const live = activeTrial();
        if (live) {
          setUnits((prev) =>
            prev.map((u) => {
              const lu = live.units.find((x) => x.uid === u.uid);
              return lu ? { ...u, haste: lu.haste } : u;
            }),
          );
        }
        setLog((l) => [ev.mode === "haste" ? "ヘイスト" : "スロウ", ...l].slice(0, 6));
        sfx("heal");
      } else if (ev.kind === "ko") {
        setUnits((prev) =>
          prev.map((u) => (u.uid === ev.uid ? { ...u, alive: false, hp: 0 } : u)),
        );
        sfx("ko");
        const u = unitsRef.current.find((x) => x.uid === ev.uid);
        setLog((l) => [`${u?.name ?? ""}　撃破`, ...l].slice(0, 6));
        if (trialRef.current && u?.side === "enemy") addKillsRef.current(1);
      } else if (ev.kind === "shift") {
        setUnits((prev) => prev.map((u) => (u.uid === ev.uid ? { ...u, slot: ev.slot } : u)));
        setLunge(null);
      } else if (ev.kind === "spawn") {
        setUnits((prev) => (prev.some((u) => u.uid === ev.unit.uid) ? prev : [...prev, { ...ev.unit }]));
        setLog((l) => [`${ev.unit.name}　出現`, ...l].slice(0, 6));
      } else if (ev.kind === "end") {
        actingRef.current = null;
        lastEndRef.current = ev;
        setActing(null);
        setFx(null);
        setLunge(null);
      }
    };

    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      const dt = Math.min((t - lastRef.current) / 1000, 0.1);
      lastRef.current = t;
      if (skipRef.current) {
        if (trialRef.current) {
          skipRef.current = false;
        } else {
          finishBattle();
          return;
        }
      }
      const dtScaled = dt * speedRef.current;
      const liveNow = trialRef.current ? activeTrial() : null;
      let ev = eventsRef.current[idxRef.current];
      if (!ev) {
        if (actingRef.current) {
          const id = actingRef.current;
          actingRef.current = null;
          setActing(null);
          if (liveNow) {
            const u = liveNow.units.find((x) => x.uid === id);
            if (u) u.gauge = 0;
          }
          setUnits((prev) => prev.map((u) => (u.uid === id ? { ...u, gauge: 0 } : u)));
        }
        if (liveNow && !lastEndRef.current) {
          advanceGauges(liveNow.units, dtScaled);
          const more = pumpTrial(liveNow, 0);
          if (more.length) eventsRef.current.push(...more);
          ev = eventsRef.current[idxRef.current];
          gaugeTickRef.current += dtScaled;
          if (gaugeTickRef.current >= 0.04) {
            gaugeTickRef.current = 0;
            setUnits((prev) =>
              prev.map((u) => {
                const lu = liveNow.units.find((x) => x.uid === u.uid);
                return lu ? { ...u, gauge: lu.gauge, haste: lu.haste } : u;
              }),
            );
          }
        }
      }
      if (!ev) {
        if (trialRef.current && !lastEndRef.current) {
          raf = requestAnimationFrame(tick);
          return;
        }
        finishBattle(lastEndRef.current ?? undefined);
        return;
      }
      if (!liveNow && ev.kind === "round") {
        gaugeTickRef.current += dtScaled;
        if (gaugeTickRef.current >= 0.05) {
          const step = gaugeTickRef.current;
          gaugeTickRef.current = 0;
          setUnits((prev) => {
            let changed = false;
            const next = prev.map((u) => {
              if (!u.alive) return u;
              const g = Math.min(GAUGE_MAX, (u.gauge ?? 0) + atbRate(u) * ATB_PER_SEC * step);
              if (g === u.gauge) return u;
              changed = true;
              return { ...u, gauge: g };
            });
            return changed ? next : prev;
          });
        }
      }
      accRef.current += dtScaled;
      const need = (DUR[ev.kind] ?? 500) / 1000;
      if (accRef.current >= need) {
        accRef.current = 0;
        stepEvent(ev);
        idxRef.current += 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (bannerTimerRef.current != null) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    };
  }, [battle, finishBattle]);

  if (!battle) return null;
  const player = units.filter((u) => u.side === "player");
  const enemy = units.filter((u) => u.side === "enemy" && u.alive);
  const node = scoutNodeId ? NODE_BY_ID[scoutNodeId] : null;
  const field: FieldKind = trial?.field ?? node?.field ?? "waste";

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden text-fg">
      <img
        src={FIELD_SRC[field]}
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg/55 via-transparent to-bg/30" />
      {flash ? <div className="fx-screen-flash pointer-events-none absolute inset-0 z-40" /> : null}
      <div className={cn("relative flex h-full min-h-0 w-full flex-col", shake && "anim-shake")}>
        <div className="absolute right-3 top-2 z-20 flex h-8 items-center gap-2 text-xs text-muted">
          <span className="font-display tracking-wider text-fg">
            {trial ? "試し撃ち" : "合戦"}
          </span>
          <span className="text-brass">{FIELD_LABEL[field]}</span>
          {trial ? <span className="tabular text-muted">撃破 {trial.kills}</span> : null}
          {log[0] ? <span className="text-fg">{log[0]}</span> : null}
          {fx ? <span className="font-display text-brass">{kindLabel(fx.kind)}</span> : null}
        </div>

        <div className="relative min-h-0 flex-1">
          {player.map((u) => (
            <UnitSpot
              key={u.uid}
              unit={u}
              acting={acting}
              struck={struck}
              float={float}
              lunge={lunge}
            />
          ))}
          {enemy.map((u) => (
            <UnitSpot
              key={u.uid}
              unit={u}
              acting={acting}
              struck={struck}
              float={float}
              lunge={lunge}
            />
          ))}
          {fx ? <SkillFx fx={fx} /> : null}
          {skillBanner ? (
            <div
              key={skillBanner.key}
              className={cn(
                "skill-name-banner pointer-events-none absolute inset-0 z-50 flex items-center justify-center",
                skillBanner.slot === "s1" ? "skill-banner-s1" : "skill-banner-s2",
              )}
              aria-hidden
            >
              <div className="skill-banner-vignette" />
              <div className="skill-banner-burst" />
              <div className="skill-banner-slash skill-banner-slash-a" />
              <div className="skill-banner-slash skill-banner-slash-b" />
              <span className="skill-banner-name font-display text-3xl tracking-[0.12em] sm:text-4xl">
                {skillBanner.name}
              </span>
            </div>
          ) : null}
        </div>

        <AtbRail units={[...player, ...enemy]} acting={acting} />

        {showAffinity ? (
          <div className="absolute inset-x-2 bottom-10 z-30 max-h-[70%] overflow-y-auto rounded-lg bg-bg/95 p-3 hairline shadow-lg">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-display text-sm text-fg">属性相性</p>
              <button
                type="button"
                onClick={() => setShowAffinity(false)}
                className="h-7 px-2 text-xs text-muted"
              >
                閉じる
              </button>
            </div>
            <AffinityDiagram compact />
          </div>
        ) : null}

        <div className="relative z-20 flex h-8 shrink-0 items-center justify-end gap-2 bg-[#0a0e18] px-3">
          <button
            type="button"
            onClick={() => setShowAffinity((v) => !v)}
            className="flex h-6 items-center rounded-sm bg-[#1c4a8a] px-2 text-[11px] tracking-wide text-white"
          >
            {showAffinity ? "相性隠す" : "相性"}
          </button>
          <button
            type="button"
            onClick={() => setBattleSpeed(nextBattleSpeed(battleSpeed))}
            className="flex h-6 items-center rounded-sm bg-[#1c4a8a] px-2 text-[11px] tracking-wide text-white"
          >
            ◂ SPEED ×{battleSpeed} ▸
          </button>
          {trial ? (
            <button
              type="button"
              onClick={() => endTrial()}
              className="flex h-6 items-center rounded-sm bg-[#1c4a8a] px-3 text-[11px] text-white"
            >
              終了
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                skipRef.current = true;
              }}
              className="flex h-6 items-center rounded-sm bg-[#1c4a8a] px-3 text-[11px] text-white"
            >
              結果へ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function kindLabel(kind: SkillKind): string {
  switch (kind) {
    case "front":
      return "単体";
    case "pierce":
      return "横一列";
    case "sweep":
      return "縦一列";
    case "random":
      return "乱撃";
    case "all":
      return "全体";
    case "heal":
      return "回復";
    case "haste":
      return "加速";
    case "slow":
      return "減速";
  }
}

function visOf(slot: number, side: Side) {
  const row = Math.floor(slot / 3);
  const col = slot % 3;
  const x = side === "player" ? 90 - col * 13 : 10 + col * 13;
  // Back/front ranks: keep depth but avoid the huge empty mid-band on 1280×720.
  const y = 44 + row * 16;
  return { x, y, row, col };
}

function lungePos(actor: Unit, slots: number[], targetSide: Side) {
  const home = visOf(actor.slot, actor.side);
  if (!slots.length) return home;
  const tp = visOf(slots[0], targetSide);
  const kind = actor.skill.kind;
  if (kind === "front") {
    const dx = targetSide === "enemy" ? 4 : -4;
    return { x: tp.x + dx, y: tp.y };
  }
  if (kind === "pierce" || kind === "sweep") {
    return { x: (home.x + tp.x) / 2, y: (home.y + tp.y) / 2 };
  }
  if (kind === "random") {
    return { x: (home.x + tp.x) / 2, y: (home.y + tp.y) / 2 };
  }
  if (kind === "heal" || kind === "haste" || kind === "slow") {
    return { x: (home.x + tp.x) / 2, y: (home.y + tp.y) / 2 };
  }
  return { x: home.x + (actor.side === "player" ? -4 : 4), y: home.y };
}

function UnitSpot({
  unit,
  acting,
  struck,
  float,
  lunge,
}: {
  unit: Unit;
  acting: string | null;
  struck: string | null;
  float: { uid: string; text: string; crit: boolean; key: number } | null;
  lunge: Lunge | null;
}) {
  const p = visOf(unit.slot, unit.side);
  const card = CARD_BY_ID[unit.cardId];
  if (!card) return null;
  const isLunge = lunge?.uid === unit.uid;
  const x = isLunge ? lunge.x : p.x;
  const y = isLunge ? lunge.y : p.y;
  return (
    <div
      className={cn("unit-spot absolute h-[38%] w-[14%] -translate-x-1/2 -translate-y-1/2", isLunge && "is-lunge")}
      style={{ left: `${x}%`, top: `${y}%`, zIndex: isLunge ? 8 : acting === unit.uid ? 6 : 2 }}
    >
      <CharSprite
        card={card}
        acting={acting === unit.uid}
        struck={struck === unit.uid}
        dimmed={!unit.alive}
        hp={unit.hp}
        maxHp={unit.maxHp}
        flip={unit.side === "player"}
        bust={unit.bust}
        float={float && float.uid === unit.uid ? float : null}
      />
    </div>
  );
}

/** Min center-to-center gap (% of rail) so ~6 portraits stay distinguishable. */
const ATB_MIN_GAP = 3.6;

function layoutAtb(units: Unit[]) {
  const raw = units
    .filter((u) => u.alive)
    .map((u) => {
      const p = Math.max(0, Math.min(1, (u.gauge ?? 0) / GAUGE_MAX));
      return { uid: u.uid, unit: u, p, left: 6 + (1 - p) * 88 };
    })
    .sort((a, b) => a.left - b.left || a.uid.localeCompare(b.uid));

  const lefts = raw.map((e) => e.left);
  for (let i = 1; i < lefts.length; i++) {
    if (lefts[i] < lefts[i - 1] + ATB_MIN_GAP) lefts[i] = lefts[i - 1] + ATB_MIN_GAP;
  }
  if (lefts.length && lefts[lefts.length - 1] > 94) {
    lefts[lefts.length - 1] = 94;
    for (let i = lefts.length - 2; i >= 0; i--) {
      if (lefts[i] > lefts[i + 1] - ATB_MIN_GAP) lefts[i] = lefts[i + 1] - ATB_MIN_GAP;
    }
  }
  if (lefts.length && lefts[0] < 6) {
    lefts[0] = 6;
    for (let i = 1; i < lefts.length; i++) {
      if (lefts[i] < lefts[i - 1] + ATB_MIN_GAP) lefts[i] = lefts[i - 1] + ATB_MIN_GAP;
    }
  }

  // Vertical lane among still-near neighbors (thin rail: ±7px).
  const lanes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (Math.abs(lefts[i] - lefts[j]) < ATB_MIN_GAP) used.add(lanes[j]);
    }
    let lane = 0;
    while (used.has(lane)) lane += 1;
    lanes[i] = lane;
  }

  return raw.map((e, i) => {
    const lane = lanes[i];
    const yOff = lane === 0 ? 0 : lane % 2 === 1 ? -7 * Math.ceil(lane / 2) : 7 * Math.ceil(lane / 2);
    return { ...e, left: lefts[i], lane, yOff };
  });
}

function AtbRail({ units, acting }: { units: Unit[]; acting: string | null }) {
  const tokens = layoutAtb(units);
  return (
    <div className="atb-rail shrink-0">
      <span className="atb-goal" />
      {tokens.map(({ unit: u, p, left, lane, yOff }) => {
        const card = CARD_BY_ID[u.cardId];
        if (!card) return null;
        const src = !card.fodder ? `/cards/${card.id}.jpg` : charSrc(card);
        const isAct = acting === u.uid;
        return (
          <span
            key={u.uid}
            className={cn("atb-token", u.side, isAct && "is-act")}
            style={{
              left: `${left}%`,
              top: `calc(50% + ${yOff}px)`,
              zIndex: isAct ? 8 : 2 + Math.floor(p * 5) + lane,
            }}
            title={u.name}
          >
            <img src={src} alt="" crossOrigin="anonymous" />
          </span>
        );
      })}
    </div>
  );
}

function SkillFx({ fx }: { fx: SkillFxState }) {
  const color = TYPE_FX[fx.type];
  const unique = [...new Set(fx.slots)];
  const shown =
    fx.kind === "front"
      ? unique.slice(0, 1)
      : fx.kind === "all"
        ? unique.slice(0, 3)
        : unique.slice(0, 3);

  return (
    <div key={fx.key} className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {shown.map((slot, i) => {
        const p = visOf(slot, fx.targetSide);
        const cls =
          fx.kind === "heal" || fx.kind === "haste" || fx.kind === "slow"
            ? "fx-hit fx-hit-heal"
            : fx.kind === "pierce"
              ? "fx-hit fx-hit-wide"
              : "fx-hit";
        const mark = fx.kind === "haste" ? "速" : fx.kind === "slow" ? "遅" : fx.kind === "heal" ? "＋" : null;
        return (
          <span
            key={`hit-${slot}-${i}`}
            className={cls}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              background: fx.kind === "heal" ? undefined : color,
              color,
              animationDelay: `${i * 50}ms`,
            }}
          >
            {mark}
          </span>
        );
      })}
    </div>
  );
}
