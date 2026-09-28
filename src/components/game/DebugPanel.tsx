import type { MouseEvent } from "react";
import { HERO_CARDS } from "@/game/data";
import { sfx } from "@/game/audio";
import { useGame } from "@/game/store";
import { CloseButton } from "./pieces";
import { cn } from "@/lib/utils";

export function DebugPanel() {
  const setDebugOpen = useGame((s) => s.setDebugOpen);
  const pseudoLandscape = useGame((s) => s.pseudoLandscape);
  const setPseudoLandscape = useGame((s) => s.setPseudoLandscape);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const setCardEditorOpen = useGame((s) => s.setCardEditorOpen);
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

  const run = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    fn();
  };

  const captureDisabled = screen !== "scout" || !scoutNodeId;

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-3"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="panel pointer-events-auto flex max-h-[92%] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-xl p-4"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <p className="font-display text-sm text-faint">内部</p>
          <CloseButton onClick={run(() => setDebugOpen(false))} className="debug-hit" />
        </div>

        <div className="stage-scroll min-h-0 flex-1 pr-1">
          <p className="mb-3 text-xs text-muted tabular">
            金 {gold}　闘気 {spirit}　所持 {Object.keys(owned).length}/{HERO_CARDS.length}　領地 {captured.length}
          </p>
          <div className="grid grid-cols-2 gap-2 pb-1">
            <DbgBtn onClick={debugAddGold}>金 +5000</DbgBtn>
            <DbgBtn onClick={debugFillSpirit}>闘気回復</DbgBtn>
            <DbgBtn onClick={debugGrantAll}>全カード</DbgBtn>
            <DbgBtn onClick={debugCaptureAll}>全占領</DbgBtn>
            <DbgBtn onClick={debugMaxLevels}>最大Lv</DbgBtn>
            <DbgBtn
              onClick={() => {
                setDebugOpen(false);
                setCatalogOpen(true);
              }}
            >
              マイデータ
            </DbgBtn>
            <DbgBtn
              onClick={() => {
                setDebugOpen(false);
                setCardEditorOpen(true);
              }}
            >
              カード編集
            </DbgBtn>
            <DbgBtn onClick={startTrial} disabled={!leaderId} hint="リーダーが必要">
              テスト戦闘
            </DbgBtn>
            <DbgBtn onClick={debugCaptureNode} disabled={captureDisabled} hint="偵察中の地が必要">
              この地を奪う
            </DbgBtn>
            <DbgBtn
              onClick={() => setPseudoLandscape(!pseudoLandscape)}
              active={pseudoLandscape}
              hint="縦枠で擬似横（Grok等で実全画面不可のため）"
            >
              {pseudoLandscape ? "全画面 ON" : "全画面"}
            </DbgBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function DbgBtn({
  children,
  onClick,
  disabled,
  hint,
  active,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  active?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active ? true : undefined}
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          sfx("click");
          onClick();
        }}
        className={cn(
          "debug-hit flex h-12 min-h-11 w-full items-center justify-center rounded-md text-sm hairline disabled:opacity-40",
          active ? "bg-panel text-brass ring-1 ring-brass/50" : "bg-raised",
        )}
      >
        {children}
      </button>
      {hint && (disabled || active) ? (
        <p className="px-0.5 text-center text-[13px] leading-tight text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
