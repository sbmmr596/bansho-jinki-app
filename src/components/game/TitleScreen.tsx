import { useRef } from "react";
import { CARD_BY_ID } from "@/game/data";
import { useGame } from "@/game/store";
import { CardFace, GhostButton, PrimaryButton } from "./pieces";

const FEATURED = ["kaien", "azuha", "fenrir"] as const;

export function TitleScreen() {
  const hasExisting = useGame((s) => s.hasExisting);
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const setHelp = useGame((s) => s.setHelp);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const unlockDebug = useGame((s) => s.unlockDebug);
  const taps = useRef(0);
  const tapTimer = useRef(0);

  const onMark = () => {
    taps.current += 1;
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 800);
    if (taps.current >= 8) {
      taps.current = 0;
      unlockDebug();
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden text-fg">
      <img
        src="/bg/title.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-bg/25" />
      <div className="relative flex h-full w-full items-center gap-5 py-3 pl-6 pr-8">
        <div className="min-w-0 max-w-md flex-1">
          <p className="mb-1 text-[10px] tracking-[0.35em] text-brass">BANSHO JINKI</p>
          <h1
            className="font-display select-none text-5xl leading-none tracking-wide"
            onClick={onMark}
          >
            万象陣記
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            カードを集め、陣を敷き、地を取れ。属性の利を読んで覇を決する。
          </p>
        </div>
        <div className="flex shrink-0 items-end gap-2">
          {FEATURED.map((id) => {
            const card = CARD_BY_ID[id];
            return card ? <CardFace key={id} card={card} size="xs" /> : null;
          })}
        </div>
        <div className="flex w-44 shrink-0 flex-col gap-2">
          {hasExisting ? (
            <PrimaryButton onClick={continueGame} className="h-11">
              つづきから
            </PrimaryButton>
          ) : null}
          {hasExisting ? (
            <GhostButton onClick={newGame} className="h-11">
              はじめから
            </GhostButton>
          ) : (
            <PrimaryButton onClick={newGame} className="h-11">
              はじめる
            </PrimaryButton>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              unlockDebug();
            }}
            className="debug-hit h-10 text-sm text-faint"
          >
            内部
          </button>
          <button
            type="button"
            onClick={() => setHelp(true)}
            className="h-10 text-sm text-muted"
          >
            遊び方
          </button>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="h-10 text-sm text-muted"
          >
            マイデータ
          </button>
        </div>
      </div>
    </div>
  );
}
