import { useMemo, useState, type MouseEvent } from "react";
import { FACTION_LABEL, HERO_CARDS } from "@/game/data";
import type { Faction } from "@/game/types";
import { sfx } from "@/game/audio";
import { useGame } from "@/game/store";
import { CardFace, CloseButton } from "./pieces";
import { requestGameDisplay } from "@/lib/display-mode";
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
  const debugFillSpirit = useGame((s) => s.debugFillSpirit);
  const debugGrantAll = useGame((s) => s.debugGrantAll);
  const debugCaptureAll = useGame((s) => s.debugCaptureAll);
  const debugMaxLevels = useGame((s) => s.debugMaxLevels);
  const debugCaptureNode = useGame((s) => s.debugCaptureNode);
  const startTrial = useGame((s) => s.startTrial);
  const leaderId = useGame((s) => s.leaderId);
  const scoutNodeId = useGame((s) => s.scoutNodeId);
  const screen = useGame((s) => s.screen);
  const gold = useGame((s) => s.gold);
  const spirit = useGame((s) => s.spirit);
  const owned = useGame((s) => s.owned);
  const captured = useGame((s) => s.captured);

  const samples = useMemo(() => {
    const byFaction = new Map<Faction, (typeof HERO_CARDS)[number]>();
    for (const card of HERO_CARDS) {
      if (!byFaction.has(card.faction)) byFaction.set(card.faction, card);
    }
    return byFaction;
  }, []);

  const run = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    fn();
  };

  const switchTab = (next: Tab) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    setTab(next);
    setPreviewBg(null);
  };

  const captureDisabled = screen !== "scout" || !scoutNodeId;

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-3"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "panel pointer-events-auto flex max-h-[92%] min-h-0 w-full flex-col overflow-hidden rounded-xl p-4",
          tab === "assets" ? "max-w-2xl" : "max-w-md",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <p className="font-display text-sm text-faint">内部</p>
          <CloseButton onClick={run(() => setDebugOpen(false))} className="debug-hit" />
        </div>

        <div className="mb-3 flex shrink-0 gap-1 rounded-md bg-raised p-1 hairline">
          <TabBtn active={tab === "ops"} onClick={switchTab("ops")}>
            操作
          </TabBtn>
          <TabBtn active={tab === "assets"} onClick={switchTab("assets")}>
            素材
          </TabBtn>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {tab === "ops" ? (
            <>
              <p className="mb-3 text-xs text-muted tabular">
                金 {gold}　闘気 {spirit}　所持 {Object.keys(owned).length}/{HERO_CARDS.length}　領地 {captured.length}
              </p>
              <div className="grid grid-cols-2 gap-2 pb-1">
                <DbgBtn onClick={debugAddGold}>金 +5000</DbgBtn>
                <DbgBtn onClick={debugFillSpirit}>闘気回復</DbgBtn>
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
                <DbgBtn onClick={startTrial} disabled={!leaderId} hint="リーダーが必要">
                  テスト戦闘
                </DbgBtn>
                <DbgBtn onClick={debugCaptureNode} disabled={captureDisabled} hint="偵察中の地が必要">
                  この地を奪う
                </DbgBtn>
                <DbgBtn onClick={() => setTab("assets")}>素材確認</DbgBtn>
                <DbgBtn
                  onClick={() => {
                    void requestGameDisplay(
                      document.querySelector(".game-frame") as HTMLElement | null,
                    );
                  }}
                >
                  全画面
                </DbgBtn>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 font-display text-xs tracking-wider text-faint">陣営背景</h3>
                <div className="grid grid-cols-3 gap-2 @sm:grid-cols-6">
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
                <div className="grid grid-cols-3 gap-2 @sm:grid-cols-4">
                  {FIELD_BGS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={run(() => setPreviewBg(bg.path))}
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
      </div>

      {previewBg ? (
        <div
          className="absolute inset-0 z-[90] flex items-center justify-center bg-bg/85 p-3"
          onClick={run(() => setPreviewBg(null))}
        >
          <div
            className="pointer-events-auto relative max-h-full max-w-full overflow-hidden rounded-lg hairline shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={previewBg} alt="" className="max-h-[85vh] max-w-[92vw] object-contain" />
            <p className="absolute inset-x-0 bottom-0 bg-bg/80 px-3 py-2 text-center text-xs text-muted tabular">
              {previewBg}
            </p>
            <CloseButton onClick={run(() => setPreviewBg(null))} className="debug-hit absolute right-2 top-2" />
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
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "debug-hit flex min-h-11 flex-1 items-center justify-center rounded text-sm transition-colors",
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
  hint,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          sfx("click");
          onClick();
        }}
        className="debug-hit flex h-12 min-h-11 w-full items-center justify-center rounded-md bg-raised text-sm hairline disabled:opacity-40"
      >
        {children}
      </button>
      {disabled && hint ? (
        <p className="px-0.5 text-center text-[9px] leading-tight text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
