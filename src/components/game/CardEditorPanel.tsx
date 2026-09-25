import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BASIC_SKILL,
  applyCatalog,
  cardBasicSkill,
  exportCatalogPayload,
  FACTION_IDS,
  FACTION_LABEL,
  FORMATION_IDS,
  FORMATIONS,
  HERO_CARDS,
  parseFormation,
  RARITY_IDS,
  RARITY_LABEL,
  SKILL_KIND_IDS,
  STARTER_IDS,
  TYPE_IDS,
  TYPE_LABEL,
} from "@/game/data";
import { CATALOG_KEY } from "@/game/catalog-api";
import {
  CATALOG_DOWNLOAD_FILENAME,
  downloadCatalogJson,
} from "@/game/catalog-download";
import {
  CARD_ART_FILES,
  cardArtPath,
  CHAR_ART_FILES,
  charArtPath,
} from "@/game/art-assets";
import { SKILL_KIND_LABEL } from "@/game/skillNames";
import type { Card, ElementType, Faction, Formation, Rarity, SkillKind } from "@/game/types";
import { useGame } from "@/game/store";
import { CardFace, CloseButton } from "./pieces";

type Tab = "cards" | "factions" | "skillKinds" | "formations";

type Draft = {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  type: ElementType;
  rarity: Rarity;
  cost: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  formation: string;
  fodder: boolean;
  basicName: string;
  basicKind: SkillKind;
  basicPower: number;
  basicHits: string;
  basicDesc: string;
  skillName: string;
  skillKind: SkillKind;
  skillPower: number;
  skillHits: string;
  skillDesc: string;
  portrait: string;
  art: string;
  bust: string;
};

function fileNameOf(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  const cleaned = path.trim().split("?")[0] ?? "";
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || fallback;
}

function toDraft(card: Card): Draft {
  const basic = cardBasicSkill(card);
  return {
    id: card.id,
    name: card.name,
    title: card.title,
    faction: card.faction,
    type: card.type,
    rarity: card.rarity,
    cost: card.cost,
    hp: card.hp,
    atk: card.atk,
    def: card.def,
    spd: card.spd,
    formation: card.formation,
    fodder: !!card.fodder,
    basicName: basic.name,
    basicKind: basic.kind,
    basicPower: basic.power,
    basicHits: basic.hits != null ? String(basic.hits) : "",
    basicDesc: basic.desc,
    skillName: card.skill.name,
    skillKind: card.skill.kind,
    skillPower: card.skill.power,
    skillHits: card.skill.hits != null ? String(card.skill.hits) : "",
    skillDesc: card.skill.desc,
    portrait: card.portrait ?? card.id,
    art: fileNameOf(card.art, `${card.id}.png`),
    bust: fileNameOf(card.bust, `${card.id}.jpg`),
  };
}

function blankDraft(seed = 1): Draft {
  const id = `custom_${Date.now().toString(36)}_${seed}`;
  return {
    id,
    name: "新規カード",
    title: "編集してください",
    faction: "koryu",
    type: "power",
    rarity: "N",
    cost: 3,
    hp: 500,
    atk: 200,
    def: 150,
    spd: 100,
    formation: "basic",
    fodder: false,
    basicName: BASIC_SKILL.name,
    basicKind: BASIC_SKILL.kind,
    basicPower: BASIC_SKILL.power,
    basicHits: "",
    basicDesc: BASIC_SKILL.desc,
    skillName: "攻撃",
    skillKind: "front",
    skillPower: 1,
    skillHits: "",
    skillDesc: "",
    portrait: id,
    art: "kaien.png",
    bust: "kaien.jpg",
  };
}

function hitsFromDraft(raw: string): number | undefined {
  const hitsRaw = raw.trim();
  return hitsRaw ? Math.max(1, Math.round(Number(hitsRaw)) || 1) : undefined;
}

function draftToCard(d: Draft): Card {
  const hits = hitsFromDraft(d.skillHits);
  const basicHits = hitsFromDraft(d.basicHits);
  const artName = d.art.trim() || `${d.id}.png`;
  const bustName = d.bust.trim() || `${d.id}.jpg`;
  return {
    id: d.id.trim(),
    name: d.name.trim() || "無名",
    title: d.title.trim(),
    faction: d.faction,
    type: d.type,
    rarity: d.rarity,
    cost: Math.max(1, Math.round(d.cost) || 1),
    hp: Math.max(1, Math.round(d.hp) || 1),
    atk: Math.max(1, Math.round(d.atk) || 1),
    def: Math.max(0, Math.round(d.def) || 0),
    spd: Math.max(1, Math.round(d.spd) || 1),
    // Material-only cards never lead; keep a harmless default formation.
    formation: d.fodder ? "basic" : FORMATIONS[d.formation] ? d.formation : "basic",
    basicSkill: {
      name: d.basicName.trim() || BASIC_SKILL.name,
      kind: d.basicKind,
      power: Number.isFinite(d.basicPower) ? d.basicPower : BASIC_SKILL.power,
      ...(basicHits != null ? { hits: basicHits } : {}),
      desc: d.basicDesc.trim(),
    },
    skill: {
      name: d.skillName.trim() || "攻撃",
      kind: d.skillKind,
      power: Number.isFinite(d.skillPower) ? d.skillPower : 1,
      ...(hits != null ? { hits } : {}),
      desc: d.skillDesc.trim(),
    },
    portrait: d.portrait.trim() || d.id.trim(),
    art: charArtPath(artName),
    bust: cardArtPath(bustName),
    ...(d.fodder ? { fodder: true as const } : {}),
  };
}


type FormationDraft = {
  id: string;
  name: string;
  desc: string;
  slots: boolean[];
  hp: string;
  atk: string;
  def: string;
  spd: string;
  frontAtk: string;
  /** When true, id field is locked (existing formation). */
  idLocked: boolean;
};

function pctFromBonus(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(Math.round(v * 1000) / 10);
}

function bonusFromPct(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n / 100;
}

function toFormationDraft(f: Formation, idLocked = true): FormationDraft {
  return {
    id: f.id,
    name: f.name,
    desc: f.desc,
    slots: [...f.slots],
    hp: pctFromBonus(f.bonus.hp),
    atk: pctFromBonus(f.bonus.atk),
    def: pctFromBonus(f.bonus.def),
    spd: pctFromBonus(f.bonus.spd),
    frontAtk: pctFromBonus(f.bonus.frontAtk),
    idLocked,
  };
}

function blankFormationDraft(): FormationDraft {
  return {
    id: `form_${Date.now().toString(36)}`,
    name: "新規陣形",
    desc: "",
    slots: [false, true, true, false, true, true, false, true, false],
    hp: "",
    atk: "",
    def: "",
    spd: "",
    frontAtk: "",
    idLocked: false,
  };
}

function draftToFormation(d: FormationDraft): Formation | null {
  const bonus: Formation["bonus"] = {};
  const hp = bonusFromPct(d.hp);
  const atk = bonusFromPct(d.atk);
  const def = bonusFromPct(d.def);
  const spd = bonusFromPct(d.spd);
  const frontAtk = bonusFromPct(d.frontAtk);
  if (hp != null) bonus.hp = hp;
  if (atk != null) bonus.atk = atk;
  if (def != null) bonus.def = def;
  if (spd != null) bonus.spd = spd;
  if (frontAtk != null) bonus.frontAtk = frontAtk;
  return parseFormation({
    id: d.id,
    name: d.name,
    desc: d.desc,
    slots: d.slots,
    bonus,
  });
}

/** Tiny 3×3. Same facing as the battle grid (front column on the left). */
function MiniFormation({ slots }: { slots: boolean[] }) {
  return (
    <span className="grid h-6 w-6 shrink-0 grid-cols-3 grid-rows-3 gap-px" aria-hidden>
      {[0, 1, 2].map((row) =>
        [2, 1, 0].map((col) => {
          const open = slots[row * 3 + col];
          return (
            <span
              key={`${row}-${col}`}
              className={open ? "rounded-[1px] bg-brass" : "rounded-[1px] bg-fg/15"}
            />
          );
        }),
      )}
    </span>
  );
}

function FormationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = FORMATIONS[value];

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const stageEl = button?.closest(".game-stage") as HTMLElement | null;
    if (button && stageEl) {
      const rect = button.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();
      const scaleY = stageRect.height / stageEl.offsetHeight || 1;
      const scaleX = stageRect.width / stageEl.offsetWidth || 1;
      const buttonTop = (rect.top - stageRect.top) / scaleY;
      const buttonBottom = (rect.bottom - stageRect.top) / scaleY;
      const menuMax = 208;
      const spaceBelow = stageEl.offsetHeight - buttonBottom;
      const openUp = spaceBelow < menuMax && buttonTop > spaceBelow;
      setBox({
        top: openUp ? Math.max(8, buttonTop - 4 - menuMax) : buttonBottom + 4,
        left: (rect.left - stageRect.left) / scaleX,
        width: rect.width / scaleX,
      });
    }
    const onDoc = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      const target = e.target as Node;
      if (menuRef.current === target || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const stage = typeof document !== "undefined" ? document.querySelector(".game-stage") : null;
  const menu =
    open && box && stage
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            className="formation-menu absolute z-[90] max-h-52 overflow-y-auto rounded-md border border-border bg-ink py-1 shadow-lg"
            style={{ top: box.top, left: box.left, width: box.width, backgroundColor: "#16120e" }}
          >
            {FORMATION_IDS.map((id) => {
              const formation = FORMATIONS[id];
              if (!formation) return null;
              const selected = id === value;
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm ${
                      selected ? "bg-[#2a241c] text-brass" : "bg-ink text-fg"
                    }`}
                    style={{ backgroundColor: selected ? "#2a241c" : "#16120e" }}
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{formation.name}</span>
                    <MiniFormation slots={formation.slots} />
                  </button>
                </li>
              );
            })}
          </ul>,
          stage,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="flex h-10 w-full items-center gap-2 rounded-md bg-raised px-2.5 text-left text-sm text-fg hairline outline-none focus:ring-1 focus:ring-brass/60"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate">{current?.name ?? value}</span>
        {current ? <MiniFormation slots={current.slots} /> : null}
      </button>
      {menu}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[13px] text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-11 w-full rounded-md bg-raised px-2.5 text-sm text-fg hairline outline-none focus:ring-1 focus:ring-brass/60";

function knownFile(name: string, list: readonly string[]) {
  const n = name.trim().replace(/^\/+/, "").split("/").pop() ?? "";
  return list.includes(n);
}

/** Plain image thumbnail (bust /cards only; no CardFace compositing). */
function DraftImgPreview({
  label,
  src,
  className,
  boxClassName,
}: {
  label: string;
  src: string;
  className?: string;
  boxClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const show = Boolean(src) && !failed;
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[12px] text-muted">{label}</span>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-md bg-raised/40 hairline ${boxClassName ?? ""}`}
      >
        {show ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[12px] text-faint">なし</span>
        )}
      </div>
    </div>
  );
}

/** Live art preview: faction bg + name plate (+ rarity) via CardFace; uses /chars art. */
function DraftArtPreview({ draft }: { draft: Draft }) {
  const previewCard = useMemo(() => draftToCard(draft), [draft]);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[12px] text-muted">art</span>
      <div className="flex justify-center overflow-hidden rounded-md bg-raised/40 px-1 py-2 hairline">
        <CardFace
          card={previewCard}
          size="lg"
          className="pointer-events-none !w-[11rem] max-w-full"
        />
      </div>
    </div>
  );
}

export function CardEditorPanel({ onClose }: { onClose: () => void }) {
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const bumpCatalog = useGame((s) => s.bumpCatalog);
  const catalogEpoch = useGame((s) => s.catalogEpoch);

  const heroes = useMemo(() => HERO_CARDS.slice(), [catalogEpoch]);
  const formationList = useMemo(() => FORMATION_IDS.map((id) => FORMATIONS[id]!).filter(Boolean), [catalogEpoch]);
  const [tab, setTab] = useState<Tab>("cards");
  const [selectedId, setSelectedId] = useState<string>(() => heroes[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(() =>
    heroes[0] ? toDraft(heroes[0]) : blankDraft(),
  );
  const [factionDraft, setFactionDraft] = useState<Record<Faction, string>>(() => ({
    ...FACTION_LABEL,
  }));
  const [skillKindDraft, setSkillKindDraft] = useState<Record<SkillKind, string>>(() => ({
    ...SKILL_KIND_LABEL,
  }));
  const [selectedFormId, setSelectedFormId] = useState<string>(() => FORMATION_IDS[0] ?? "basic");
  const [formDraft, setFormDraft] = useState<FormationDraft>(() => {
    const f = FORMATIONS[FORMATION_IDS[0] ?? "basic"] ?? FORMATIONS.basic;
    return f ? toFormationDraft(f) : blankFormationDraft();
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        FACTION_LABEL[c.faction].includes(filter.trim()),
    );
  }, [heroes, filter]);

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const selectCard = (id: string) => {
    const card = HERO_CARDS.find((c) => c.id === id);
    if (!card) return;
    setSelectedId(id);
    setDraft(toDraft(card));
    setMsg("");
  };

  const buildHeroList = (mode: "save-draft" | "delete"): Card[] => {
    if (mode === "delete") {
      return HERO_CARDS.filter((c) => c.id !== selectedId).map((c) => ({ ...c }));
    }
    const next = draftToCard(draft);
    const withoutOld = HERO_CARDS.filter((c) => c.id !== selectedId && c.id !== next.id).map(
      (c) => ({ ...c }),
    );
    withoutOld.push(next);
    return withoutOld;
  };

  const openSlotCount = formDraft.slots.filter(Boolean).length;
  const formSlotsValid = openSlotCount >= 3 && openSlotCount <= 5;

  const currentFormationsPayload = (): Record<string, Formation> => {
    const out: Record<string, Formation> = {};
    for (const id of FORMATION_IDS) {
      const f = FORMATIONS[id];
      if (f) out[id] = { id: f.id, name: f.name, desc: f.desc, slots: [...f.slots], bonus: { ...f.bonus } };
    }
    return out;
  };

  const persist = (
    heroesList: Card[],
    factions: Record<Faction, string>,
    skillKinds: Record<SkillKind, string>,
    formations?: Record<string, Formation>,
  ) => {
    const n = applyCatalog(
      {
        chars: heroesList,
        factions,
        skillKinds,
        formations: formations ?? currentFormationsPayload(),
        replaceAll: true,
      },
      { replaceAll: true },
    );
    if (!n) throw new Error("empty catalog");
    const text = JSON.stringify(exportCatalogPayload());
    try {
      localStorage.setItem(CATALOG_KEY, text);
    } catch {
      /* private mode */
    }
    setCatalogSource("custom");
    bumpCatalog();
    return n;
  };

  const onSaveCard = () => {
    setBusy(true);
    setMsg("");
    try {
      const id = draft.id.trim();
      if (!id) {
        setMsg("IDを入力してください。");
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        setMsg("IDは半角英数・_・-のみ。");
        return;
      }
      const n = persist(buildHeroList("save-draft"), factionDraft, skillKindDraft);
      setSelectedId(id);
      const saved = HERO_CARDS.find((c) => c.id === id);
      if (saved) setDraft(toDraft(saved));
      setMsg(`${n}人を端末に保存した。ドライブへは「JSONを書き出す」で chars.json を置いてね。`);
    } catch {
      setMsg("保存に失敗した。入力を確認してね。");
    } finally {
      setBusy(false);
    }
  };

  const onAdd = () => {
    const d = blankDraft(HERO_CARDS.length + 1);
    setSelectedId(d.id);
    setDraft(d);
    setTab("cards");
    setMsg("新規カード — 内容を入れて保存してね。");
  };

  const onDelete = () => {
    if ((STARTER_IDS as readonly string[]).includes(selectedId)) {
      setMsg("初期メンバーは削除できない。");
      return;
    }
    if (!window.confirm(`「${draft.name}」(${selectedId}) を削除する？`)) return;
    setBusy(true);
    setMsg("");
    try {
      const heroesList = buildHeroList("delete");
      if (!heroesList.length) {
        setMsg("これ以上削除できない。");
        return;
      }
      const n = persist(heroesList, factionDraft, skillKindDraft);
      const next = HERO_CARDS[0];
      if (next) {
        setSelectedId(next.id);
        setDraft(toDraft(next));
      }
      setMsg(`${n}人に更新（削除済み・端末に保存）。`);
    } catch {
      setMsg("削除に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const onSaveFactions = () => {
    setBusy(true);
    setMsg("");
    try {
      const n = persist(
        HERO_CARDS.map((c) => ({ ...c })),
        factionDraft,
        skillKindDraft,
      );
      setMsg(`陣営名を端末に保存した（カード ${n}人）。`);
    } catch {
      setMsg("陣営の保存に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const onSaveSkillKinds = () => {
    setBusy(true);
    setMsg("");
    try {
      const n = persist(
        HERO_CARDS.map((c) => ({ ...c })),
        factionDraft,
        skillKindDraft,
      );
      setMsg(`スキル種類名を端末に保存した（カード ${n}人）。`);
    } catch {
      setMsg("スキル種類の保存に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const selectFormation = (id: string) => {
    const f = FORMATIONS[id];
    if (!f) return;
    setSelectedFormId(id);
    setFormDraft(toFormationDraft(f, true));
    setMsg("");
  };

  const patchForm = <K extends keyof FormationDraft>(key: K, value: FormationDraft[K]) => {
    setFormDraft((d) => ({ ...d, [key]: value }));
  };

  const toggleFormSlot = (idx: number) => {
    setFormDraft((d) => {
      const slots = [...d.slots];
      slots[idx] = !slots[idx];
      return { ...d, slots };
    });
  };

  const onAddFormation = () => {
    const d = blankFormationDraft();
    setSelectedFormId(d.id);
    setFormDraft(d);
    setTab("formations");
    setMsg("新規陣形 — スロット3〜5を開けて保存してね。");
  };

  const onDeleteFormation = () => {
    const id = formDraft.idLocked ? selectedFormId : formDraft.id.trim();
    if (id === "basic") {
      setMsg("均衡陣（basic）は削除できない。");
      return;
    }
    if (!FORMATIONS[id]) {
      setMsg("未保存の新規なので削除ではなく破棄してね。");
      return;
    }
    if (FORMATION_IDS.length <= 1) {
      setMsg("これ以上削除できない。");
      return;
    }
    if (!window.confirm(`陣形「${formDraft.name}」(${id}) を削除する？`)) return;
    setBusy(true);
    setMsg("");
    try {
      const next = currentFormationsPayload();
      delete next[id];
      if (!Object.keys(next).length) {
        setMsg("これ以上削除できない。");
        return;
      }
      // Remap cards that pointed at the deleted formation.
      const heroesList = HERO_CARDS.map((c) => ({
        ...c,
        formation: c.formation === id ? "basic" : c.formation,
      }));
      const n = persist(heroesList, factionDraft, skillKindDraft, next);
      const fallbackId = FORMATION_IDS.includes("basic") ? "basic" : FORMATION_IDS[0]!;
      setSelectedFormId(fallbackId);
      const f = FORMATIONS[fallbackId];
      if (f) setFormDraft(toFormationDraft(f, true));
      setMsg(`陣形を削除した（カード ${n}人・端末に保存）。`);
    } catch {
      setMsg("陣形の削除に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const onSaveFormations = () => {
    setBusy(true);
    setMsg("");
    try {
      if (!formSlotsValid) {
        setMsg("開放スロットは3〜5にしてね。");
        return;
      }
      const parsed = draftToFormation(formDraft);
      if (!parsed) {
        setMsg("陣形の入力が不正（ID・スロットを確認）。");
        return;
      }
      const prevId = formDraft.idLocked ? selectedFormId : null;
      const next = currentFormationsPayload();
      if (prevId && prevId !== parsed.id) {
        delete next[prevId];
      }
      next[parsed.id] = parsed;
      // Remap cards if id changed
      const heroesList = HERO_CARDS.map((c) => {
        const copy = { ...c };
        if (prevId && prevId !== parsed.id && copy.formation === prevId) {
          copy.formation = parsed.id;
        }
        return copy;
      });
      const n = persist(heroesList, factionDraft, skillKindDraft, next);
      setSelectedFormId(parsed.id);
      const saved = FORMATIONS[parsed.id];
      if (saved) setFormDraft(toFormationDraft(saved, true));
      setMsg(`陣形を端末に保存した（カード ${n}人）。`);
    } catch {
      setMsg("陣形の保存に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const onExportJson = () => {
    try {
      // Prefer in-memory catalog after any unsaved draft? Spec: export current loaded catalog.
      // If user edited draft without saving, export still reflects last persist — note that.
      downloadCatalogJson();
      setMsg(
        `「${CATALOG_DOWNLOAD_FILENAME}」を書き出した。万象陣記フォルダに置き、マイデータの「ドライブから読む」で読み直せるよ。`,
      );
    } catch {
      setMsg("JSONの書き出しに失敗した。");
    }
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel flex max-h-[92%] min-h-0 w-[96%] max-w-6xl flex-col overflow-hidden rounded-xl p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <p className="font-display text-sm text-fg">カード編集</p>
          <CloseButton onClick={onClose} />
        </div>

        <p className="mb-2 shrink-0 text-[13px] leading-relaxed text-faint">
          いま読み込んでいるカタログ（標準・ドライブ・ファイル・端末）を編集する。保存は端末のみ。ドライブへは「JSONを書き出す」→ 万象陣記/chars.json
          → マイデータの「ドライブから読む」。グラフィックは既存ファイル名を参照（アップロードなし）。
        </p>
        {msg ? <p className="mb-2 shrink-0 text-xs text-brass">{msg}</p> : null}

        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5">
          <div className="inline-flex min-w-0 gap-0.5 rounded-md bg-raised p-0.5 hairline">
            <button
              type="button"
              className={`inline-flex h-11 items-center justify-center rounded px-3 text-sm ${tab === "cards" ? "bg-panel text-brass" : "text-muted"}`}
              onClick={() => setTab("cards")}
            >
              カード
            </button>
            <button
              type="button"
              className={`inline-flex h-11 items-center justify-center rounded px-3 text-sm ${tab === "factions" ? "bg-panel text-brass" : "text-muted"}`}
              onClick={() => setTab("factions")}
            >
              陣営
            </button>
            <button
              type="button"
              className={`inline-flex h-11 items-center justify-center rounded px-3 text-sm ${tab === "skillKinds" ? "bg-panel text-brass" : "text-muted"}`}
              onClick={() => setTab("skillKinds")}
            >
              スキル種類
            </button>
            <button
              type="button"
              className={`inline-flex h-11 items-center justify-center rounded px-3 text-sm ${tab === "formations" ? "bg-panel text-brass" : "text-muted"}`}
              onClick={() => setTab("formations")}
            >
              陣形
            </button>
          </div>
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            {tab === "factions" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSaveFactions}
                className="inline-flex h-11 items-center justify-center shrink-0 rounded-md bg-brass px-3 text-sm font-medium text-bg disabled:opacity-40"
              >
                陣営名を保存
              </button>
            ) : tab === "skillKinds" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSaveSkillKinds}
                className="inline-flex h-11 items-center justify-center shrink-0 rounded-md bg-brass px-3 text-sm font-medium text-bg disabled:opacity-40"
              >
                スキル種類名を保存
              </button>
            ) : tab === "formations" ? (
              <button
                type="button"
                disabled={busy || !formSlotsValid}
                onClick={onSaveFormations}
                className="inline-flex h-11 items-center justify-center shrink-0 rounded-md bg-brass px-3 text-sm font-medium text-bg disabled:opacity-40"
              >
                陣形を保存
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onSaveCard}
                className="inline-flex h-11 items-center justify-center shrink-0 rounded-md bg-brass px-3 text-sm font-medium text-bg disabled:opacity-40"
              >
                このカードを保存
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onExportJson}
              className="inline-flex h-11 items-center justify-center shrink-0 rounded-md bg-raised px-3 text-sm text-fg hairline disabled:opacity-40"
            >
              JSONを書き出す
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === "factions" ? (
            <div className="stage-scroll min-h-0 flex-1 pr-1">
              <div className="flex flex-col gap-2 pb-2">
                {FACTION_IDS.map((id) => (
                  <Field key={id} label={id}>
                    <input
                      className={inputCls}
                      value={factionDraft[id]}
                      onChange={(e) =>
                        setFactionDraft((f) => ({ ...f, [id]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          ) : tab === "skillKinds" ? (
            <div className="stage-scroll min-h-0 flex-1 pr-1">
              <div className="flex flex-col gap-2 pb-2">
                {SKILL_KIND_IDS.map((id) => (
                  <Field key={id} label={id}>
                    <input
                      className={inputCls}
                      value={skillKindDraft[id]}
                      onChange={(e) =>
                        setSkillKindDraft((f) => ({ ...f, [id]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          ) : tab === "formations" ? (
            <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
              <div className="flex w-[22%] min-h-0 min-w-0 flex-col gap-2">
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={onAddFormation}
                    className="h-11 flex-1 rounded-md bg-brass text-xs font-medium text-bg"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDeleteFormation}
                    className="h-11 flex-1 rounded-md bg-raised text-xs text-fg hairline disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
                <div className="stage-scroll min-h-0 flex-1 rounded-md bg-raised/40 hairline">
                  {formationList.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFormation(f.id)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-2 py-2.5 text-left ${
                        f.id === selectedFormId ? "bg-brass/20" : ""
                      }`}
                    >
                      <span className="truncate text-sm text-fg">{f.name}</span>
                      <span className="truncate text-[12px] text-faint tabular">
                        {f.id} · 開放{f.slots.filter(Boolean).length}
                      </span>
                    </button>
                  ))}
                  {!formDraft.idLocked && !FORMATIONS[formDraft.id] ? (
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 bg-brass/20 px-2 py-2.5 text-left"
                    >
                      <span className="truncate text-sm text-fg">{formDraft.name}</span>
                      <span className="truncate text-[12px] text-faint tabular">新規 · 未保存</span>
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="stage-scroll min-h-0 min-w-0 flex-1 pr-1">
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <Field label="ID（英数・_・-）">
                    <input
                      className={inputCls}
                      value={formDraft.id}
                      disabled={formDraft.idLocked}
                      onChange={(e) => patchForm("id", e.target.value)}
                    />
                  </Field>
                  <Field label="名称">
                    <input
                      className={inputCls}
                      value={formDraft.name}
                      onChange={(e) => patchForm("name", e.target.value)}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="説明">
                      <input
                        className={inputCls}
                        value={formDraft.desc}
                        onChange={(e) => patchForm("desc", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-1 text-[13px] text-muted">
                      スロット（タップで開閉）・開放{" "}
                      <span className={formSlotsValid ? "text-brass" : "text-crimson"}>
                        {openSlotCount}
                      </span>
                      /3〜5
                    </p>
                    <div className="grid w-fit grid-cols-3 gap-1.5">
                      {formDraft.slots.map((open, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleFormSlot(i)}
                          className={`flex h-12 w-12 items-center justify-center rounded-md text-xs hairline ${
                            open ? "bg-brass/30 text-brass" : "bg-raised/60 text-faint"
                          }`}
                          aria-label={`slot ${i + 1} ${open ? "open" : "closed"}`}
                        >
                          {open ? "開" : "閉"}
                        </button>
                      ))}
                    </div>
                    {!formSlotsValid ? (
                      <p className="mt-1 text-[13px] text-crimson">開放スロットは3〜5必須</p>
                    ) : null}
                  </div>
                  <Field label="HPボーナス（%）">
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={formDraft.hp}
                      onChange={(e) => patchForm("hp", e.target.value)}
                      placeholder="例: 12"
                    />
                  </Field>
                  <Field label="攻ボーナス（%）">
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={formDraft.atk}
                      onChange={(e) => patchForm("atk", e.target.value)}
                      placeholder="例: 10"
                    />
                  </Field>
                  <Field label="防ボーナス（%）">
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={formDraft.def}
                      onChange={(e) => patchForm("def", e.target.value)}
                    />
                  </Field>
                  <Field label="速ボーナス（%）">
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={formDraft.spd}
                      onChange={(e) => patchForm("spd", e.target.value)}
                    />
                  </Field>
                  <Field label="前列攻ボーナス（%）">
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={formDraft.frontAtk}
                      onChange={(e) => patchForm("frontAtk", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
              <div className="stage-scroll flex w-[12.5rem] shrink-0 flex-col gap-2 pr-0.5">
                <DraftArtPreview draft={draft} />
                <DraftImgPreview
                  label="bust"
                  src={draft.bust.trim() ? cardArtPath(draft.bust.trim()) : ""}
                  className="items-center"
                  boxClassName="aspect-[2/3] w-[7.5rem]"
                />
              </div>

              <div className="flex w-[22%] min-h-0 min-w-0 flex-col gap-2">
                <input
                  className={`${inputCls} shrink-0`}
                  placeholder="検索（名前 / ID）"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={onAdd}
                    className="h-11 flex-1 rounded-md bg-brass text-xs font-medium text-bg"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDelete}
                    className="h-11 flex-1 rounded-md bg-raised text-xs text-fg hairline disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
                <div className="stage-scroll min-h-0 flex-1 rounded-md bg-raised/40 hairline">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCard(c.id)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-2 py-2.5 text-left ${
                        c.id === selectedId ? "bg-brass/20" : ""
                      }`}
                    >
                      <span className="flex w-full items-center gap-1 truncate text-sm text-fg">
                        <span className="truncate">{c.name}</span>
                        {c.fodder ? (
                          <span className="shrink-0 rounded-sm bg-crimson/80 px-1 text-[11px] font-semibold text-fg">
                            素材
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-[12px] text-faint tabular">
                        {c.id} · {FACTION_LABEL[c.faction]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="stage-scroll min-h-0 min-w-0 flex-1 pr-1">
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <Field label="ID">
                    <input className={inputCls} value={draft.id} onChange={(e) => patch("id", e.target.value)} />
                  </Field>
                  <Field label="名称">
                    <input className={inputCls} value={draft.name} onChange={(e) => patch("name", e.target.value)} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="称号">
                      <input className={inputCls} value={draft.title} onChange={(e) => patch("title", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="陣営">
                    <select className={inputCls} value={draft.faction} onChange={(e) => patch("faction", e.target.value as Faction)}>
                      {FACTION_IDS.map((id) => (
                        <option key={id} value={id}>{factionDraft[id] || FACTION_LABEL[id]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="属性">
                    <select className={inputCls} value={draft.type} onChange={(e) => patch("type", e.target.value as ElementType)}>
                      {TYPE_IDS.map((id) => (
                        <option key={id} value={id}>{TYPE_LABEL[id]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="レア">
                    <select className={inputCls} value={draft.rarity} onChange={(e) => patch("rarity", e.target.value as Rarity)}>
                      {RARITY_IDS.map((id) => (
                        <option key={id} value={id}>{RARITY_LABEL[id]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="コスト">
                    <input type="number" className={inputCls} value={draft.cost} onChange={(e) => patch("cost", Number(e.target.value))} />
                  </Field>
                  <Field label="HP">
                    <input type="number" className={inputCls} value={draft.hp} onChange={(e) => patch("hp", Number(e.target.value))} />
                  </Field>
                  <Field label="攻撃">
                    <input type="number" className={inputCls} value={draft.atk} onChange={(e) => patch("atk", Number(e.target.value))} />
                  </Field>
                  <Field label="防御">
                    <input type="number" className={inputCls} value={draft.def} onChange={(e) => patch("def", Number(e.target.value))} />
                  </Field>
                  <Field label="速度">
                    <input type="number" className={inputCls} value={draft.spd} onChange={(e) => patch("spd", Number(e.target.value))} />
                  </Field>
                  <label className="col-span-2 flex h-11 items-center gap-2 rounded-md bg-raised px-2.5 text-sm text-fg hairline">
                    <input
                      type="checkbox"
                      checked={draft.fodder}
                      onChange={(e) => patch("fodder", e.target.checked)}
                      className="h-4 w-4 accent-brass"
                    />
                    <span>素材用（編成・陣形に参加しない）</span>
                  </label>
                  {!draft.fodder ? (
                    <div className="flex min-w-0 flex-col gap-0.5 text-[11px] text-muted">
                      <span>陣形</span>
                      <FormationSelect value={draft.formation} onChange={(id) => patch("formation", id)} />
                    </div>
                  ) : null}
                  <p className="col-span-2 text-[13px] leading-snug text-muted">
                    基本技は行動抽選の基本枠。回復・加速・減速はダメージなし（加速と減速はATB）。未設定の古いデータは通常攻撃。
                  </p>
                  <Field label="基本技 攻撃方法">
                    <select className={inputCls} value={draft.basicKind} onChange={(e) => patch("basicKind", e.target.value as SkillKind)}>
                      {SKILL_KIND_IDS.map((id) => (
                        <option key={id} value={id}>{skillKindDraft[id] || SKILL_KIND_LABEL[id]}（{id}）</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="基本技 名前">
                    <input className={inputCls} value={draft.basicName} onChange={(e) => patch("basicName", e.target.value)} />
                  </Field>
                  <Field label="基本技 威力">
                    <input type="number" step="0.01" className={inputCls} value={draft.basicPower} onChange={(e) => patch("basicPower", Number(e.target.value))} />
                  </Field>
                  <Field label="基本技 ヒット数（空欄可）">
                    <input className={inputCls} value={draft.basicHits} onChange={(e) => patch("basicHits", e.target.value)} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="基本技 説明">
                      <input className={inputCls} value={draft.basicDesc} onChange={(e) => patch("basicDesc", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="必殺技1 攻撃方法">
                    <select className={inputCls} value={draft.skillKind} onChange={(e) => patch("skillKind", e.target.value as SkillKind)}>
                      {SKILL_KIND_IDS.map((id) => (
                        <option key={id} value={id}>{skillKindDraft[id] || SKILL_KIND_LABEL[id]}（{id}）</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="必殺技1 名前">
                    <input className={inputCls} value={draft.skillName} onChange={(e) => patch("skillName", e.target.value)} />
                  </Field>
                  <Field label="必殺技1 威力">
                    <input type="number" step="0.01" className={inputCls} value={draft.skillPower} onChange={(e) => patch("skillPower", Number(e.target.value))} />
                  </Field>
                  <Field label="必殺技1 ヒット数（空欄可）">
                    <input className={inputCls} value={draft.skillHits} onChange={(e) => patch("skillHits", e.target.value)} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="必殺技1 説明">
                      <input className={inputCls} value={draft.skillDesc} onChange={(e) => patch("skillDesc", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="portrait">
                    <input className={inputCls} value={draft.portrait} onChange={(e) => patch("portrait", e.target.value)} />
                  </Field>
                  <Field label={`art /chars/ ${knownFile(draft.art, CHAR_ART_FILES) ? "✓" : "⚠"}`}>
                    <input list="char-art-files" className={inputCls} value={draft.art} onChange={(e) => patch("art", e.target.value)} />
                  </Field>
                  <Field label={`bust /cards/ ${knownFile(draft.bust, CARD_ART_FILES) ? "✓" : "⚠"}`}>
                    <input list="card-art-files" className={inputCls} value={draft.bust} onChange={(e) => patch("bust", e.target.value)} />
                  </Field>
                </div>
                <datalist id="char-art-files">
                  {CHAR_ART_FILES.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
                <datalist id="card-art-files">
                  {CARD_ART_FILES.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
