import type { PointerEvent } from "react";
import { sfx } from "@/game/audio";
import { HERO_CARDS } from "@/game/data";
import { useGame } from "@/game/store";

export function DebugPanel() {
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

  const run = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx("click");
    fn();
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-3"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="panel w-full max-w-md rounded-xl p-4"
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
        </div>
      </div>
    </div>
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
