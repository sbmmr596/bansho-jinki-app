import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { SignInButtons, UserButton } from "@/lib/auth/gates";
import {
  authEnabled,
  getPreviewBearerMeta,
  subscribePreviewBearer,
} from "@/lib/auth/client";
import { resolveSignInGateState } from "@/lib/auth/sign-in-gate";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  applyCatalog,
  exportCatalogPayload,
  FACTION_IDS,
  FACTION_LABEL,
  FORMATION_IDS,
  FORMATIONS,
  HERO_CARDS,
  RARITY_IDS,
  RARITY_LABEL,
  SKILL_KIND_IDS,
  STARTER_IDS,
  TYPE_IDS,
  TYPE_LABEL,
} from "@/game/data";
import { CATALOG_KEY, saveUserCatalog } from "@/game/catalog-api";
import {
  CARD_ART_FILES,
  cardArtPath,
  CHAR_ART_FILES,
  charArtPath,
} from "@/game/art-assets";
import { SKILL_KIND_LABEL } from "@/game/skillNames";
import type { Card, ElementType, Faction, Rarity, SkillKind } from "@/game/types";
import { useGame } from "@/game/store";
import { CloseButton } from "./pieces";

type Tab = "cards" | "factions";

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

function draftToCard(d: Draft): Card {
  const hitsRaw = d.skillHits.trim();
  const hits = hitsRaw ? Math.max(1, Math.round(Number(hitsRaw)) || 1) : undefined;
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
    formation: FORMATIONS[d.formation] ? d.formation : "basic",
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
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[11px] text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-md bg-raised px-2.5 text-sm text-fg hairline outline-none focus:ring-1 focus:ring-brass/60";

function knownFile(name: string, list: readonly string[]) {
  const n = name.trim().replace(/^\/+/, "").split("/").pop() ?? "";
  return list.includes(n);
}

export function CardEditorPanel({ onClose }: { onClose: () => void }) {
  const { user, isPending, sessionResolveTimedOut } = useCurrentUserState();
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const bumpCatalog = useGame((s) => s.bumpCatalog);
  const catalogEpoch = useGame((s) => s.catalogEpoch);

  const heroes = useMemo(() => HERO_CARDS.slice(), [catalogEpoch]);
  const [tab, setTab] = useState<Tab>("cards");
  const [selectedId, setSelectedId] = useState<string>(() => heroes[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(() =>
    heroes[0] ? toDraft(heroes[0]) : blankDraft(),
  );
  const [factionDraft, setFactionDraft] = useState<Record<Faction, string>>(() => ({
    ...FACTION_LABEL,
  }));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const bearerMeta = useSyncExternalStore(
    subscribePreviewBearer,
    getPreviewBearerMeta,
    () => ({ hasBearer: false, appliedAt: null }),
  );
  const gateState = resolveSignInGateState({
    isPending,
    hasUser: user !== null,
    hasPreviewBearer: bearerMeta.hasBearer,
    previewBearerAppliedAt: bearerMeta.appliedAt,
  });
  const signedIn = gateState === "signed_in";
  const canEdit = signedIn;

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

  const persist = async (heroesList: Card[], factions: Record<Faction, string>) => {
    const n = applyCatalog(
      {
        chars: heroesList,
        factions,
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
    if (user) {
      try {
        await saveUserCatalog({ data: text });
      } catch {
        /* local keep */
      }
    }
    return n;
  };

  const onSaveCard = async () => {
    if (!canEdit) return;
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
      const n = await persist(buildHeroList("save-draft"), factionDraft);
      setSelectedId(id);
      const saved = HERO_CARDS.find((c) => c.id === id);
      if (saved) setDraft(toDraft(saved));
      setMsg(`${n}人を保存した（このアカウントの上書き）。`);
    } catch {
      setMsg("保存に失敗した。入力を確認してね。");
    } finally {
      setBusy(false);
    }
  };

  const onAdd = () => {
    if (!canEdit) return;
    const d = blankDraft(HERO_CARDS.length + 1);
    setSelectedId(d.id);
    setDraft(d);
    setTab("cards");
    setMsg("新規カード — 内容を入れて保存してね。");
  };

  const onDelete = async () => {
    if (!canEdit) return;
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
      const n = await persist(heroesList, factionDraft);
      const next = HERO_CARDS[0];
      if (next) {
        setSelectedId(next.id);
        setDraft(toDraft(next));
      }
      setMsg(`${n}人に更新（削除済み）。`);
    } catch {
      setMsg("削除に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  const onSaveFactions = async () => {
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const n = await persist(
        HERO_CARDS.map((c) => ({ ...c })),
        factionDraft,
      );
      setMsg(`陣営名を保存した（カード ${n}人）。`);
    } catch {
      setMsg("陣営の保存に失敗した。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel flex max-h-[92%] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <p className="font-display text-sm text-fg">カード編集</p>
          <CloseButton onClick={onClose} />
        </div>

        <div className="mb-2 min-h-8 shrink-0">
          {gateState === "pending" ? (
            <p className="text-xs text-muted">接続中…</p>
          ) : (
            <UserButton />
          )}
        </div>

        {gateState === "pending" ? (
          <div className="stage-scroll min-h-0 flex-1 space-y-3 p-2">
            <p className="text-xs text-brass">接続中…</p>
            <p className="text-xs text-muted">セッションを確認しています…</p>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md bg-raised px-4 text-sm text-fg hairline"
            >
              元に戻る
            </button>
          </div>
        ) : gateState === "signed_out" ? (
          <div className="stage-scroll min-h-0 flex-1 space-y-3 p-2">
            {sessionResolveTimedOut ? (
              <p className="text-xs leading-relaxed text-red-400">
                セッション確認がタイムアウトしました。通信やポップアップを確認して、もう一度サインインしてね。
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted">
                Googleアカウントでサインインすると、カード内容・陣営をこのアカウント専用に編集・保存できるよ。サインアウト時は標準カタログのまま。
              </p>
            )}
            {authEnabled ? <SignInButtons /> : null}
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md bg-raised px-4 text-sm text-fg hairline"
            >
              元に戻る
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 shrink-0 text-[11px] leading-relaxed text-faint">
              変更はこのアカウントの上書きのみ。未サインイン／他ユーザーは標準データを使う。グラフィックは既存ファイル名を参照（アップロードなし）。
            </p>
            {msg ? <p className="mb-2 shrink-0 text-xs text-brass">{msg}</p> : null}

            <div className="mb-2 flex shrink-0 gap-1 rounded-md bg-raised p-1 hairline">
              <button
                type="button"
                className={`h-11 flex-1 rounded text-sm ${tab === "cards" ? "bg-panel text-brass" : "text-muted"}`}
                onClick={() => setTab("cards")}
              >
                カード
              </button>
              <button
                type="button"
                className={`h-11 flex-1 rounded text-sm ${tab === "factions" ? "bg-panel text-brass" : "text-muted"}`}
                onClick={() => setTab("factions")}
              >
                陣営
              </button>
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
              ) : (
                <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
                  <div className="flex w-[38%] min-h-0 min-w-0 flex-col gap-2">
                    <input
                      className={`${inputCls} shrink-0`}
                      placeholder="検索（名前 / ID）"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={onAdd}
                        className="h-10 flex-1 rounded-md bg-brass text-xs font-medium text-bg disabled:opacity-40"
                      >
                        追加
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() => void onDelete()}
                        className="h-10 flex-1 rounded-md bg-raised text-xs text-fg hairline disabled:opacity-40"
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
                          <span className="truncate text-xs text-fg">{c.name}</span>
                          <span className="truncate text-[10px] text-faint tabular">
                            {c.id} · {FACTION_LABEL[c.faction]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="stage-scroll min-h-0 flex-1 pr-1">
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
                      <Field label="陣形">
                        <select className={inputCls} value={draft.formation} onChange={(e) => patch("formation", e.target.value)}>
                          {FORMATION_IDS.map((id) => (
                            <option key={id} value={id}>{FORMATIONS[id]?.name ?? id}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="攻撃方法（スキル種別）">
                        <select className={inputCls} value={draft.skillKind} onChange={(e) => patch("skillKind", e.target.value as SkillKind)}>
                          {SKILL_KIND_IDS.map((id) => (
                            <option key={id} value={id}>{SKILL_KIND_LABEL[id]}（{id}）</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="スキル名">
                        <input className={inputCls} value={draft.skillName} onChange={(e) => patch("skillName", e.target.value)} />
                      </Field>
                      <Field label="スキル威力">
                        <input type="number" step="0.01" className={inputCls} value={draft.skillPower} onChange={(e) => patch("skillPower", Number(e.target.value))} />
                      </Field>
                      <Field label="ヒット数（空欄可）">
                        <input className={inputCls} value={draft.skillHits} onChange={(e) => patch("skillHits", e.target.value)} />
                      </Field>
                      <div className="col-span-2">
                        <Field label="スキル説明">
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

            <div className="mt-2 flex shrink-0 flex-col gap-1 border-t border-white/10 pt-2">
              {tab === "factions" ? (
                <button
                  type="button"
                  disabled={busy || !canEdit}
                  onClick={() => void onSaveFactions()}
                  className="h-11 w-full rounded-md bg-brass text-sm font-medium text-bg disabled:opacity-40"
                >
                  陣営名を保存
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !canEdit}
                  onClick={() => void onSaveCard()}
                  className="h-11 w-full rounded-md bg-brass text-sm font-medium text-bg disabled:opacity-40"
                >
                  このカードを保存
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
