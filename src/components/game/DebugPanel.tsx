import { useMemo, useState, type PointerEvent } from "react";
import { FACTION_LABEL, HERO_CARDS } from "@/game/data";
import type { Faction } from "@/game/types";
import { sfx } from "@/game/audio";
import { useGame } from "@/game/store";
import { CardFace } from "./pieces";
import { cn } from "@/lib/utils";

type Tab = "ops" | "assets";

const FACTIONS: Faction[] = ["koryu", "tekki", "tensho", "metsujin", "reiju", "yukei"];

const FIELD_BGS = [
  { id: "battle", path: "/bg/battle.jpg", label: "battle" },
  { id: "field", path: "/bg/field.jpg", label: "field" },
  { id: "forest", path: "/bg/forest.jpg", label: "forest" },
  { id: "grass", path: "/bg/grass.jpg", label: "grass" },
  { id: "magma", path: "/bg/magma.jpg", label: "magma" },
  { id: "map", path: "/bg/map.jpg", label: "map" },
  { id: "palace", path: "/bg/palace.jpg", label: "palace" },
  { id: "snow", path: "/bg/snow.jpg", label: "snow" },
  { id: "title", path: "/bg/title.jpg", label: "title" },
] as const;

export function DebugPanel() {
  const [tab, setTab] = useState<Tab>("ops");
  const [previewBg, setPreviewBg] = useState<string | null>(null);

  const setDebugOpen = useGame((s) => s.setDebugOpen);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const debugAddGold = useGame((s) => s.debugAddGold);
  const debugGrantAll = useGame((s) => s.debugGrantAll);
  const debugCaptureAll = useGame((s) => s.debugCaptureAll);
  const debugMaxLevels = useGame((s) => s.debugMaxLevels);
  const debugCaptureNode = useGame((s) => s.debugCaptureNode);
  const startTrial = useGame((s) => s.startTrial);
  const leaderId = useGame((s) => s.leaderId);
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const screen = useGame((s) => s.screen);
  const gold = useGame((s) => s.gold);
  const owned = useGame((s) => s.owned);
  const captured = useGame((s) => s.captured);

  const samples = useMemo(() => {
    const byFaction = new Map<Faction, (typeof HERO_CARDS)[number]>();
    for (const card of HERO_CARDS) {
      if (!byFaction.has(card.faction)) byFaction.set(card.faction, card);
    }
    return byFaction;
  }, []);

  const run = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    fn();
  };

  const switchTab = (next: Tab) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    setTab(next);
    setPreviewBg(null);
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-3"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "panel flex max-h-[92%] w-full flex-col rounded-xl p-4",
          tab === "assets" ? "max-w-2xl" : "max-w-md",
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-sm text-faint">内部</p>
          <button
            type="button"
            onPointerDown={run(() => setDebugOpen(false))}
            className="flex h-11 min-w-16 items-center justify-center px-3 text-sm text-muted"
          >
            閉じる
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-md bg-raised p-1 hairline">
          <TabBtn active={tab === "ops"} onClick={switchTab("ops")}>
            操作
          </TabBtn>
          <TabBtn active={tab === "assets"} onClick={switchTab("assets")}>
            素材
          </TabBtn>
        </div>

        {tab === "ops" ? (
          <>
            <p className="mb-3 text-xs text-muted tabular">
              金 {gold}　所持 {Object.keys(owned).length}/{HERO_CARDS.length}　領地 {captured.length}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DbgBtn onClick={debugAddGold}>金 +5000</DbgBtn>
              <DbgBtn onClick={debugGrantAll}>全カード</DbgBtn>
              <DbgBtn onClick={debugCaptureAll}>全占領</DbgBtn>
              <DbgBtn onClick={debugMaxLevels}>最大Lv</DbgBtn>
              <DbgBtn onClick={() => window.dispatchEvent(new Event("bansho-art-trial"))}>
                イラスト試作
              </DbgBtn>
              <DbgBtn
                onClick={() => {
                  setDebugOpen(false);
                  setCatalogOpen(true);
                }}
              >
                マイデータ
              </DbgBtn>
              <DbgBtn onClick={startTrial} disabled={!leaderId}>
                テスト戦闘
              </DbgBtn>
              <DbgBtn onClick={debugCaptureNode} disabled={screen !== "scout" || !scoutNodeId}>
                この地を奪う
              </DbgBtn>
              <DbgBtn onClick={() => setTab("assets")}>素材確認</DbgBtn>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section>
              <h3 className="mb-2 font-display text-xs tracking-wider text-faint">陣営背景</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {FACTIONS.map((faction) => {
                  const path = `/factions/${faction}.svg`;
                  return (
                    <div key={faction} className="flex flex-col items-center gap-1">
                      <div className="relative w-full max-w-[88px] overflow-hidden rounded-md aspect-[2/3] ring-1 ring-white/15">
                        <img src={path} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                      <p className="text-center text-[10px] text-muted">{FACTION_LABEL[faction]}</p>
                      <p className="break-all text-center text-[9px] text-faint tabular">{path}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-display text-xs tracking-wider text-faint">陣営プレビュー</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {FACTIONS.map((faction) => {
                  const card = samples.get(faction);
                  if (!card) {
                    return (
                      <div
                        key={faction}
                        className="flex w-[120px] aspect-[2/3] items-center justify-center rounded-md bg-raised text-[10px] text-muted hairline"
                      >
                        {FACTION_LABEL[faction]}
                      </div>
                    );
                  }
                  return <CardFace key={faction} card={card} size="md" />;
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-display text-xs tracking-wider text-faint">フィールド背景</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {FIELD_BGS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onPointerDown={run(() => setPreviewBg(bg.path))}
                    className="debug-hit flex flex-col gap-1 overflow-hidden rounded-md text-left hairline"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-raised">
                      <img src={bg.path} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    <p className="px-1 text-[10px] text-muted">{bg.label}</p>
                    <p className="break-all px-1 pb-1 text-[9px] text-faint tabular">{bg.path}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {previewBg ? (
        <div
          className="absolute inset-0 z-[90] flex items-center justify-center bg-bg/85 p-3"
          onPointerDown={run(() => setPreviewBg(null))}
        >
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-lg hairline shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <img src={previewBg} alt="" className="max-h-[85vh] max-w-[92vw] object-contain" />
            <p className="absolute inset-x-0 bottom-0 bg-bg/80 px-3 py-2 text-center text-xs text-muted tabular">
              {previewBg}
            </p>
            <button
              type="button"
              onPointerDown={run(() => setPreviewBg(null))}
              className="absolute right-2 top-2 flex h-10 min-w-14 items-center justify-center rounded-md bg-raised/90 px-3 text-sm text-muted hairline"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({
  children,
  active,
  onClick,
}: {
  children: string;
  active: boolean;
  onClick: (e: PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onClick}
      className={cn(
        "flex h-10 flex-1 items-center justify-center rounded text-sm transition-colors",
        active ? "bg-panel text-brass" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}

function DbgBtn({
  children,
  onClick,
  disabled,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        sfx("click");
        onClick();
      }}
      className="debug-hit flex h-12 items-center justify-center rounded-md bg-raised text-sm hairline disabled:opacity-40"
    >
      {children}
    </button>
  );
}
