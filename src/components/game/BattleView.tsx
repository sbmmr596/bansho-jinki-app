import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/audio";
import { CARD_BY_ID } from "@/game/data";
import { rankForXp } from "@/game/rank";
import { FIELD_LABEL, findStageNode } from "@/game/solo-map";
import { advanceGauges, GAUGE_MAX, affinityLabel, stepUnitGauge } from "@/game/combat";
import { cloneStatus, kindWithEffectLabel, SKILL_EFFECT_POP, statusBadges } from "@/game/skill-effects";
import { activeTrial, pumpTrial } from "@/game/trial";
import { BATTLE_PRELOAD_TIMEOUT_MS, preloadImages } from "@/game/preload";
import { useGame } from "@/game/store";
import { SKILL_KIND_LABEL } from "@/game/skillNames";
import { BACKDROP_ART, BACKDROP_H, BACKDROP_W, BATTLE_FIELD_SRC, backdropLayout } from "@/game/battle-backdrop";
import type { BattleEvent, BattleLog, ElementType, FieldKind, Side, SkillEffect, SkillKind, Unit } from "@/game/types";
import { nextBattleSpeed } from "@/game/types";
import { CharSprite, charSrc, CloseButton } from "./pieces";
import { AffinityDiagram } from "./AffinityDiagram";
import { cn } from "@/lib/utils";

const DUR: Record<BattleEvent["kind"], number> = {
  round: 280,
  skill: 720,
  hit: 720,
  heal: 720,
  ko: 280,
  shift: 240,
  spawn: 300,
  buff: 700,
  effect: 720,
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

function collectBattleImageUrls(battle: BattleLog, field: FieldKind): string[] {
  const urls = new Set<string>();
  urls.add(BATTLE_FIELD_SRC[field]);
  const addCard = (cardId: string, bust?: boolean) => {
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    // Same path CharSprite / charSrc would use for battle sprites.
    const sprite = charSrc(card, !!bust);
    if (sprite) urls.add(sprite);
    // ATB rail thumbnails for non-fodder units.
    if (!card.fodder) urls.add(`/cards/${card.id}.jpg`);
  };
  for (const u of battle.units) addCard(u.cardId, u.bust);
  for (const ev of battle.events) {
    if (ev.kind === "spawn") addCard(ev.unit.cardId, ev.unit.bust);
  }
  return [...urls];
}

type SkillFxState = {
  key: number;
  kind: SkillKind;
  effect?: SkillEffect;
  /** Effect-only skill landing on allies (e.g. 攻撃力アップ with power 0). */
  support: boolean;
  type: ElementType;
  targetSide: Side;
  slots: number[];
  actorSlot: number;
  actorSide: Side;
};

type Lunge = { uid: string; x: number; y: number };

type FloatFx = {
  uid: string;
  text: string;
  kind: "damage" | "heal";
  affinity: "クリティカル" | "ガード" | null;
  key: number;
};

/** 追加効果 popups (防御↓ / 遅延 / 停止 / 攻撃↑ / ガード無効). Several per unit may stack. */
type StatusPop = {
  uid: string;
  text: string;
  tone: "buff" | "debuff" | "stop" | "pierce";
  key: number;
};

function popTone(effect: SkillEffect): StatusPop["tone"] {
  if (effect === "atkUp") return "buff";
  if (effect === "stop") return "stop";
  if (effect === "guardIgnore") return "pierce";
  return "debuff";
}

/** Apply one sim `effect` event to a view unit (playback copy or live mirror). */
function applyEffectToView(u: Unit, e: Extract<BattleEvent, { kind: "effect" }>): Unit {
  const next: Unit = { ...u, status: cloneStatus(e.status) };
  if (e.effect === "delay") next.gauge = Math.max(0, (u.gauge ?? 0) - e.value);
  return next;
}

export function BattleView() {
  const battle = useGame((s) => s.battle);
  const finishBattle = useGame((s) => s.finishBattle);
  const endTrial = useGame((s) => s.endTrial);
  const addTrialKills = useGame((s) => s.addTrialKills);
  const trial = useGame((s) => s.trial);
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const stage = useGame((s) => s.stage);
  const xp = useGame((s) => s.xp);
  const [units, setUnits] = useState<Unit[]>(() => battle?.units.map((u) => ({ ...u })) ?? []);
  /** Damage/heal numbers — multiple for pierce/sweep applied in one beat. */
  const [floats, setFloats] = useState<FloatFx[]>([]);
  const [pops, setPops] = useState<StatusPop[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  /** Uids flinching this beat (multi-target hits share one frame). */
  const [struck, setStruck] = useState<string[]>([]);
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
  /** Index of event already stepEvent'd at start of its DUR (skill early-present). */
  const presentedIdxRef = useRef(-1);
  /** When a hit batch consumes several events, advance past the last index after DUR. */
  const batchEndRef = useRef(-1);
  const unitsRef = useRef(units);
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadDone, setLoadDone] = useState(0);
  const [loadTotal, setLoadTotal] = useState(0);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // Preload field BG + char sprites before playback (all entry paths go through BattleView).
  useEffect(() => {
    if (!battle) {
      setAssetsReady(false);
      return;
    }
    const node = scoutNodeId ? findStageNode(rankForXp(xp), stage, scoutNodeId) : null;
    const field: FieldKind = trial?.field ?? node?.field ?? "waste";
    const urls = collectBattleImageUrls(battle, field);
    let cancelled = false;
    setAssetsReady(false);
    setLoadDone(0);
    setLoadTotal(urls.length);
    void preloadImages(urls, {
      timeoutMs: BATTLE_PRELOAD_TIMEOUT_MS,
      onProgress: (done, total) => {
        if (cancelled) return;
        setLoadDone(done);
        setLoadTotal(total);
      },
    }).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [battle, trial?.field, scoutNodeId, stage, xp]);

  useEffect(() => {
    if (!battle || !assetsReady) return;
    setUnits(battle.units.map((u) => ({ ...u })));
    setFloats([]);
    setPops([]);
    setActing(null);
    setStruck([]);
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
    presentedIdxRef.current = -1;
    batchEndRef.current = -1;
    eventsRef.current = battle.events.slice();
    let raf = 0;
    const stepEvent = (ev: BattleEvent) => {
      if (ev.kind === "round") {
        setLog((l) => [`第${ev.n}合`, ...l].slice(0, 6));
        setFx(null);
        setStruck([]);
        setFloats([]);
        setPops([]);
        setLunge(null);
        actingRef.current = null;
        setActing(null);
      } else if (ev.kind === "skill") {
        const prevAct = actingRef.current;
        actingRef.current = ev.actorUid;
        setActing(ev.actorUid);
        setFloats([]);
        setPops([]);
        setStruck([]);
        const live = activeTrial();
        // Actor's buff/debuff after its action-start tick (expired / atkUp spent).
        const withActorStatus = (u: Unit): Unit =>
          ev.actorStatus ? { ...u, gauge: GAUGE_MAX, status: cloneStatus(ev.actorStatus) } : { ...u, gauge: GAUGE_MAX };
        if (live) {
          setUnits((prev) =>
            prev.map((u) => {
              if (u.uid === ev.actorUid) return withActorStatus(u);
              if (u.uid === prevAct) return { ...u, gauge: 0 };
              const lu = live.units.find((x) => x.uid === u.uid);
              return lu ? { ...u, haste: lu.haste } : u;
            }),
          );
        } else {
          setUnits((prev) =>
            prev.map((u) =>
              u.uid === ev.actorUid ? withActorStatus(u) : u.uid === prevAct ? { ...u, gauge: 0 } : u,
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
          const kind = ev.skillKind;
          const slots: number[] = [];
          let targetSide: Side =
            kind === "heal" || kind === "haste"
              ? u.side
              : u.side === "player"
                ? "enemy"
                : "player";
          /** Hits/heals/buff define the FX; effects only do for effect-only skills. */
          let primary = false;
          for (let i = idxRef.current + 1; i < eventsRef.current.length; i++) {
            const ne = eventsRef.current[i];
            if (ne.kind === "effect") {
              if (primary) continue;
              const tu =
                unitsRef.current.find((x) => x.uid === ne.targetUid) ??
                activeTrial()?.units.find((x) => x.uid === ne.targetUid);
              if (tu) {
                slots.push(tu.slot);
                targetSide = tu.side;
              }
              continue;
            }
            if (ne.kind === "hit" || ne.kind === "heal" || ne.kind === "buff") primary = true;
            if (ne.kind === "hit" || ne.kind === "heal") {
              const tu =
                unitsRef.current.find((x) => x.uid === ne.targetUid) ??
                activeTrial()?.units.find((x) => x.uid === ne.targetUid);
              if (tu && (kind === "heal" || tu.side !== u.side)) {
                slots.push(tu.slot);
                targetSide = tu.side;
              }
            } else if (ne.kind === "buff") {
              const side = kind === "haste" ? u.side : targetSide;
              for (const tu of unitsRef.current) {
                if (tu.alive && tu.side === side) slots.push(tu.slot);
              }
            } else if (ne.kind === "ko") continue;
            else break;
          }
          const support = !primary && targetSide === u.side && kind !== "heal" && kind !== "haste";
          setFx({
            key: idxRef.current,
            kind,
            effect: ev.skillEffect,
            support,
            type: u.type,
            targetSide,
            slots,
            actorSlot: u.slot,
            actorSide: u.side,
          });
          const dest = lungePos(u, slots, targetSide, support ? "heal" : kind);
          setLunge({ uid: u.uid, x: dest.x, y: dest.y });
        }
      } else if (ev.kind === "hit" || ev.kind === "effect") {
        // Pierce / sweep / multi-hit: apply consecutive hit (+ interleaved ko) in one beat.
        // 追加効果 events that follow the hits land in the same beat (or alone for effect-only skills).
        const events = eventsRef.current;
        let i = idxRef.current;
        const hits: Extract<BattleEvent, { kind: "hit" }>[] = [];
        const kos: Extract<BattleEvent, { kind: "ko" }>[] = [];
        const effs: Extract<BattleEvent, { kind: "effect" }>[] = [];
        while (i < events.length) {
          const e = events[i];
          if (e.kind === "hit" && !effs.length) {
            hits.push(e);
            i++;
          } else if (e.kind === "ko" && !effs.length) {
            kos.push(e);
            i++;
          } else if (e.kind === "effect") {
            effs.push(e);
            i++;
          } else break;
        }
        batchEndRef.current = i - 1;
        const hpAfter = new Map(hits.map((h) => [h.targetUid, h.hpAfter]));
        const statusAfterHit = new Map(
          hits.filter((h) => h.targetStatus).map((h) => [h.targetUid, h.targetStatus!]),
        );
        const koSet = new Set(kos.map((k) => k.uid));
        setUnits((prev) => {
          let next = prev.map((u) => {
            let nu = u;
            if (statusAfterHit.has(u.uid)) nu = { ...nu, status: cloneStatus(statusAfterHit.get(u.uid)) };
            if (hpAfter.has(u.uid)) {
              const hp = hpAfter.get(u.uid)!;
              return { ...nu, hp, alive: hp > 0 && !koSet.has(u.uid) };
            }
            if (koSet.has(u.uid)) return { ...nu, alive: false, hp: 0 };
            return nu;
          });
          for (const e of effs) next = next.map((u) => (u.uid === e.targetUid ? applyEffectToView(u, e) : u));
          unitsRef.current = next;
          return next;
        });
        setPops([
          ...hits
            .filter((h) => h.guardIgnored)
            .map((h, n) => ({
              uid: h.targetUid,
              text: SKILL_EFFECT_POP.guardIgnore,
              tone: popTone("guardIgnore"),
              key: idxRef.current * 31 + n,
            })),
          ...effs.map((e, n) => ({
            uid: e.targetUid,
            text: SKILL_EFFECT_POP[e.effect],
            tone: popTone(e.effect),
            key: idxRef.current * 31 + 7 + n,
          })),
        ]);
        if (!hits.length) {
          setStruck(effs.filter((e) => e.effect !== "atkUp").map((e) => e.targetUid));
          sfx(effs.some((e) => e.effect === "atkUp") ? "heal" : "hit");
          const names = [...new Set(effs.map((e) => SKILL_EFFECT_POP[e.effect]))].join("・");
          if (names) setLog((l) => [names, ...l].slice(0, 6));
        }
        setFloats(
          hits.map((h, n) => ({
            uid: h.targetUid,
            text: String(h.damage),
            kind: "damage" as const,
            affinity: affinityLabel(h.mod),
            key: h.targetUid.length + h.damage + idxRef.current + n * 17,
          })),
        );
        if (hits.length) setStruck(hits.map((h) => h.targetUid));
        for (const k of kos) {
          const u = unitsRef.current.find((x) => x.uid === k.uid);
          setLog((l) => [`${u?.name ?? ""}　撃破`, ...l].slice(0, 6));
          if (trialRef.current && u?.side === "enemy") addKillsRef.current(1);
        }
        if (kos.length) sfx("ko");
        if (!hits.length) {
          /* effect-only beat: sfx already played */
        } else if (hits.some((h) => h.mod >= 1.45)) {
          sfx("crit");
          setShake(true);
          setFlash(true);
          window.setTimeout(() => setShake(false), 180);
          window.setTimeout(() => setFlash(false), 160);
        } else sfx("hit");
      } else if (ev.kind === "heal") {
        // Multi-target heal in one presentation beat (same pattern as hit).
        const events = eventsRef.current;
        let i = idxRef.current;
        const heals: Extract<BattleEvent, { kind: "heal" }>[] = [];
        const effs: Extract<BattleEvent, { kind: "effect" }>[] = [];
        while (i < events.length && events[i].kind === "heal" && !effs.length) {
          heals.push(events[i] as Extract<BattleEvent, { kind: "heal" }>);
          i++;
        }
        // 回復＋追加効果 (e.g. 攻撃力アップ) shows in the same beat.
        while (i < events.length && events[i].kind === "effect") {
          effs.push(events[i] as Extract<BattleEvent, { kind: "effect" }>);
          i++;
        }
        batchEndRef.current = i - 1;
        const hpAfter = new Map(heals.map((h) => [h.targetUid, h.hpAfter]));
        setUnits((prev) => {
          let next = prev.map((u) => (hpAfter.has(u.uid) ? { ...u, hp: hpAfter.get(u.uid)! } : u));
          for (const e of effs) next = next.map((u) => (u.uid === e.targetUid ? applyEffectToView(u, e) : u));
          unitsRef.current = next;
          return next;
        });
        setPops(
          effs.map((e, n) => ({
            uid: e.targetUid,
            text: SKILL_EFFECT_POP[e.effect],
            tone: popTone(e.effect),
            key: idxRef.current * 31 + 7 + n,
          })),
        );
        setFloats(
          heals.map((h, n) => ({
            uid: h.targetUid,
            text: `+${h.amount}`,
            kind: "heal" as const,
            affinity: null,
            key: idxRef.current + n * 17,
          })),
        );
        setStruck(heals.map((h) => h.targetUid));
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
        } else {
          // Playback snapshot starts at haste 1; mirror the sim multiplier so ATB bars follow.
          const mul = ev.mode === "haste" ? 1.15 : 0.85;
          const actor = unitsRef.current.find((x) => x.uid === ev.actorUid);
          if (actor) {
            setUnits((prev) => {
              const next = prev.map((u) => {
                if (!u.alive) return u;
                const affected = ev.mode === "haste" ? u.side === actor.side : u.side !== actor.side;
                if (!affected) return u;
                return { ...u, haste: Math.max(0.5, Math.min(2, (u.haste ?? 1) * mul)) };
              });
              unitsRef.current = next;
              return next;
            });
          }
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
          // Idle between actions only — never advance while an action is presenting.
          if (!actingRef.current) {
            advanceGauges(liveNow.units, dtScaled);
          }
          const more = pumpTrial(liveNow, 0);
          if (more.length) eventsRef.current.push(...more);
          ev = eventsRef.current[idxRef.current];
          gaugeTickRef.current += dtScaled;
          if (gaugeTickRef.current >= 0.04) {
            gaugeTickRef.current = 0;
            const actingId = actingRef.current;
            setUnits((prev) =>
              prev.map((u) => {
                if (actingId) {
                  // Freeze others; pin actor at max during any residual presentation.
                  if (u.uid === actingId) {
                    return u.gauge === GAUGE_MAX ? u : { ...u, gauge: GAUGE_MAX };
                  }
                  return u;
                }
                const lu = liveNow.units.find((x) => x.uid === u.uid);
                return lu ? { ...u, gauge: lu.gauge, haste: lu.haste, status: cloneStatus(lu.status) } : u;
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
      // Pre-simulated (arena/map) playback: ATB flows every frame by spd while idle.
      // While an action is presenting (skill/hit/heal/…), freeze other tokens.
      // Skill is early-presented only AFTER the actor's visual gauge reaches GAUGE_MAX
      // (idle fill with acting=null), then freeze covers skill windup + follow-up hits.
      if (!liveNow) {
        const boundary =
          ev.kind === "skill" || ev.kind === "round" || ev.kind === "end";
        const skillAlreadyOut =
          ev.kind === "skill" && presentedIdxRef.current === idxRef.current;
        // Action finished → next skill/round/end: end presentation, then resume gauges.
        // If a skill banner is still up, keep freezing (and pause event time) until it ends
        // so tokens never move under an active banner/FX.
        // Do not clear when this skill was already early-presented (same idx).
        if (actingRef.current && boundary && !skillAlreadyOut) {
          if (bannerTimerRef.current != null) {
            gaugeTickRef.current += dtScaled;
            if (gaugeTickRef.current >= 0.05) {
              gaugeTickRef.current = 0;
              const actingId = actingRef.current;
              setUnits((prev) => {
                let changed = false;
                const next = prev.map((u) => {
                  if (u.uid !== actingId) return u;
                  if (u.gauge === GAUGE_MAX) return u;
                  changed = true;
                  return { ...u, gauge: GAUGE_MAX };
                });
                return changed ? next : prev;
              });
            }
            raf = requestAnimationFrame(tick);
            return;
          }
          const doneId = actingRef.current;
          actingRef.current = null;
          setActing(null);
          setFx(null);
          setLunge(null);
          setStruck([]);
          setFloats([]);
          setPops([]);
          setSkillBanner(null);
          setUnits((prev) => {
            const next = prev.map((u) => (u.uid === doneId ? { ...u, gauge: 0 } : u));
            unitsRef.current = next;
            return next;
          });
        }
        // Idle-fill before skill present: keep acting null and advance all gauges until
        // the would-be actor reaches GAUGE_MAX. Do not count time toward skill DUR yet.
        if (ev.kind === "skill" && presentedIdxRef.current !== idxRef.current) {
          const actorUid = ev.actorUid;
          const actorGauge =
            unitsRef.current.find((u) => u.uid === actorUid)?.gauge ?? 0;
          if (actorGauge < GAUGE_MAX) {
            gaugeTickRef.current += dtScaled;
            if (gaugeTickRef.current >= 0.05) {
              const step = gaugeTickRef.current;
              gaugeTickRef.current = 0;
              setUnits((prev) => {
                let changed = false;
                const next = prev.map((u) => {
                  if (!u.alive) return u;
                  // Same fill as the sim; ATB停止 holds the token until its time runs out.
                  const nu = stepUnitGauge(u, step);
                  if (nu !== u) changed = true;
                  return nu;
                });
                if (changed) unitsRef.current = next;
                return changed ? next : prev;
              });
            }
            raf = requestAnimationFrame(tick);
            return;
          }
          // Actor full — early-present: pin + banner/FX, then wait DUR with freeze.
          stepEvent(ev);
          presentedIdxRef.current = idxRef.current;
        }
        const actingId = actingRef.current;
        gaugeTickRef.current += dtScaled;
        if (gaugeTickRef.current >= 0.05) {
          const step = gaugeTickRef.current;
          gaugeTickRef.current = 0;
          if (actingId) {
            // Freeze everyone else; keep actor pinned at left until action ends.
            setUnits((prev) => {
              let changed = false;
              const next = prev.map((u) => {
                if (u.uid !== actingId) return u;
                if (u.gauge === GAUGE_MAX) return u;
                changed = true;
                return { ...u, gauge: GAUGE_MAX };
              });
              return changed ? next : prev;
            });
          } else {
            setUnits((prev) => {
              let changed = false;
              const next = prev.map((u) => {
                if (!u.alive) return u;
                const nu = stepUnitGauge(u, step);
                if (nu !== u) changed = true;
                return nu;
              });
              if (changed) unitsRef.current = next;
              return changed ? next : prev;
            });
          }
        }
      } else if (ev.kind === "skill" && presentedIdxRef.current !== idxRef.current) {
        // Live trial: wait until actor visual gauge is full before early-present.
        // While filling, acting stays null so gauges can advance/sync.
        const actorUid = ev.actorUid;
        const actorGauge =
          unitsRef.current.find((u) => u.uid === actorUid)?.gauge ?? 0;
        if (actorGauge < GAUGE_MAX) {
          if (!actingRef.current) {
            advanceGauges(liveNow.units, dtScaled);
          }
          gaugeTickRef.current += dtScaled;
          if (gaugeTickRef.current >= 0.04) {
            gaugeTickRef.current = 0;
            setUnits((prev) => {
              const next = prev.map((u) => {
                const lu = liveNow.units.find((x) => x.uid === u.uid);
                return lu ? { ...u, gauge: lu.gauge, haste: lu.haste, status: cloneStatus(lu.status) } : u;
              });
              unitsRef.current = next;
              return next;
            });
          }
          raf = requestAnimationFrame(tick);
          return;
        }
        stepEvent(ev);
        presentedIdxRef.current = idxRef.current;
      }
      accRef.current += dtScaled;
      const need = (DUR[ev.kind] ?? 500) / 1000;
      if (accRef.current >= need) {
        accRef.current = 0;
        if (presentedIdxRef.current !== idxRef.current) {
          stepEvent(ev);
          presentedIdxRef.current = idxRef.current;
        }
        // Hit/heal batches advance past trailing ko/extra hits in one DUR beat.
        if (batchEndRef.current >= idxRef.current) {
          idxRef.current = batchEndRef.current + 1;
          batchEndRef.current = -1;
        } else {
          idxRef.current += 1;
        }
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
  }, [battle, assetsReady, finishBattle]);

  if (!battle) return null;
  const player = units.filter((u) => u.side === "player");
  const enemy = units.filter((u) => u.side === "enemy" && u.alive);
  const node = scoutNodeId ? findStageNode(rankForXp(xp), stage, scoutNodeId) : null;
  const field: FieldKind = trial?.field ?? node?.field ?? "waste";

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden text-fg">
      <BattleBackdrop src={BATTLE_FIELD_SRC[field]} />
      <div className="absolute inset-0 bg-gradient-to-t from-bg/55 via-transparent to-bg/30" />
      {flash ? <div className="fx-screen-flash pointer-events-none absolute inset-0 z-40" /> : null}
      {!assetsReady ? (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-bg/75"
          aria-busy
          aria-live="polite"
        >
          <p className="font-display text-lg tracking-[0.18em] text-fg">準備中…</p>
          {loadTotal > 0 ? (
            <p className="tabular text-xs text-muted">
              {Math.min(loadDone, loadTotal)} / {loadTotal}
            </p>
          ) : (
            <p className="text-xs text-muted">画像を読み込み中</p>
          )}
        </div>
      ) : null}
      <div className={cn("relative flex h-full min-h-0 w-full flex-col", shake && "anim-shake")}>
        <div className="absolute right-3 top-2 z-20 flex h-9 max-w-[calc(100%-1.5rem)] items-center gap-2 overflow-hidden text-xs text-muted">
          <span className="font-display tracking-wider text-fg">
            {trial ? "試し撃ち" : "合戦"}
          </span>
          <span className="text-brass">{FIELD_LABEL[field]}</span>
          {trial ? <span className="tabular text-muted">撃破 {trial.kills}</span> : null}
          {log[0] ? <span className="min-w-0 truncate text-fg">{log[0]}</span> : null}
          {fx ? <span className="font-display text-brass">{kindWithEffectLabel(kindLabel(fx.kind), fx.effect)}</span> : null}
        </div>

        <div className="relative min-h-0 flex-1">
          {player.map((u) => (
            <UnitSpot
              key={u.uid}
              unit={u}
              acting={acting}
              struck={struck}
              floats={floats}
              pops={pops}
              lunge={lunge}
            />
          ))}
          {enemy.map((u) => (
            <UnitSpot
              key={u.uid}
              unit={u}
              acting={acting}
              struck={struck}
              floats={floats}
              pops={pops}
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
              <span className="skill-banner-name font-display text-3xl tracking-[0.12em] @sm:text-4xl">
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
              <CloseButton onClick={() => setShowAffinity(false)} />
            </div>
            <AffinityDiagram compact />
          </div>
        ) : null}

        <div className="relative z-20 flex h-12 shrink-0 items-center justify-end gap-2 bg-[#0a0e18] px-3">
          <button
            type="button"
            onClick={() => setShowAffinity((v) => !v)}
            className="flex h-11 items-center rounded-sm bg-[#1c4a8a] px-3 text-[15px] tracking-wide text-white"
          >
            {showAffinity ? "相性隠す" : "相性"}
          </button>
          <button
            type="button"
            onClick={() => setBattleSpeed(nextBattleSpeed(battleSpeed))}
            className="flex h-11 items-center rounded-sm bg-[#1c4a8a] px-3 text-[15px] tracking-wide text-white"
          >
            ◂ SPEED ×{battleSpeed} ▸
          </button>
          {trial ? (
            <button
              type="button"
              onClick={() => endTrial()}
              className="flex h-11 items-center rounded-sm bg-[#1c4a8a] px-3 text-[15px] text-white"
            >
              終了
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                skipRef.current = true;
              }}
              className="flex h-11 items-center rounded-sm bg-[#1c4a8a] px-3 text-[15px] text-white"
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
  return SKILL_KIND_LABEL[kind];
}

/** 空を切り詰め、地面を広げた戦闘背景（上段のキャラが地に立って見えるように）。 */
function BattleBackdrop({ src }: { src: string }) {
  const art = BACKDROP_ART[src];
  if (!art) {
    return <img src={src} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />;
  }
  const l = backdropLayout(art);
  const vb = (v: { x: number; y: number; w: number; h: number }) => `${v.x} ${v.y} ${v.w} ${v.h}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${BACKDROP_W} ${BACKDROP_H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <svg x={0} y={0} width={BACKDROP_W} height={l.horizonY} viewBox={vb(l.sky)} preserveAspectRatio="none">
        <image href={src} width={art.w} height={art.h} crossOrigin="anonymous" />
      </svg>
      {/* 1px overlap hides any hairline seam at the horizon. */}
      <svg
        x={0}
        y={l.horizonY - 1}
        width={BACKDROP_W}
        height={BACKDROP_H - l.horizonY + 1}
        viewBox={vb(l.ground)}
        preserveAspectRatio="none"
      >
        <image href={src} width={art.w} height={art.h} crossOrigin="anonymous" />
      </svg>
    </svg>
  );
}

function visOf(slot: number, side: Side) {
  const row = Math.floor(slot / 3);
  const col = slot % 3;
  const x = side === "player" ? 90 - col * 13 : 10 + col * 13;
  const y = 22 + row * 28;
  return { x, y, row, col };
}

function lungePos(actor: Unit, slots: number[], targetSide: Side, kind: SkillKind = actor.skill.kind) {
  const home = visOf(actor.slot, actor.side);
  if (!slots.length) return home;
  const tp = visOf(slots[0], targetSide);
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
  floats,
  pops,
  lunge,
}: {
  unit: Unit;
  acting: string | null;
  struck: string[];
  floats: FloatFx[];
  pops: StatusPop[];
  lunge: Lunge | null;
}) {
  const p = visOf(unit.slot, unit.side);
  const card = CARD_BY_ID[unit.cardId];
  if (!card) return null;
  const isLunge = lunge?.uid === unit.uid;
  const x = isLunge ? lunge.x : p.x;
  const y = isLunge ? lunge.y : p.y;
  const float = floats.find((f) => f.uid === unit.uid) ?? null;
  const myPops = pops.filter((f) => f.uid === unit.uid);
  const badges = unit.alive ? statusBadges(unit.status) : [];
  return (
    <div
      className={cn("unit-spot absolute h-[38%] w-[14%] -translate-x-1/2 -translate-y-1/2", isLunge && "is-lunge")}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        // 追加効果 popups sit above a lunging attacker so 停止 / 遅延 stay readable.
        zIndex: myPops.length ? 9 : isLunge ? 8 : acting === unit.uid ? 6 : 2,
      }}
    >
      <CharSprite
        card={card}
        acting={acting === unit.uid}
        struck={struck.includes(unit.uid)}
        dimmed={!unit.alive}
        hp={unit.hp}
        maxHp={unit.maxHp}
        flip={unit.side === "player"}
        bust={unit.bust}
        float={float}
        pops={myPops}
        badges={badges}
        leader={unit.isLeader}
      />
    </div>
  );
}

function AtbRail({ units, acting }: { units: Unit[]; acting: string | null }) {
  const alive = units.filter((u) => u.alive);
  return (
    <div className={cn("atb-rail shrink-0", acting && "is-frozen")}>
      <span className="atb-goal" />
      {alive.map((u) => {
        const card = CARD_BY_ID[u.cardId];
        if (!card) return null;
        const src = !card.fodder ? `/cards/${card.id}.jpg` : charSrc(card);
        const p = Math.max(0, Math.min(1, (u.gauge ?? 0) / GAUGE_MAX));
        const left = 6 + (1 - p) * 88;
        const isAct = acting === u.uid;
        return (
          <span
            key={u.uid}
            className={cn("atb-token", u.side, isAct && "is-act")}
            style={{ left: `${left}%`, zIndex: isAct ? 8 : 2 + Math.floor(p * 5) }}
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
          fx.support || fx.kind === "heal" || fx.kind === "haste" || fx.kind === "slow"
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
              background: fx.kind === "heal" || fx.support ? undefined : color,
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
