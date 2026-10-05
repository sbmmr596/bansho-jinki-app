import { useRef, useState } from "react";
import { DIFFICULTIES, DIFFICULTY_META, difficultyLabel } from "@/game/difficulty";
import { useGame } from "@/game/store";
import type { Difficulty } from "@/game/types";
import { cn } from "@/lib/utils";
import { GhostButton, PrimaryButton } from "./pieces";

export function TitleScreen() {
  const hasExisting = useGame((s) => s.hasExisting);
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const setHelp = useGame((s) => s.setHelp);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const unlockDebug = useGame((s) => s.unlockDebug);
  const pseudoLandscape = useGame((s) => s.pseudoLandscape);
  const setPseudoLandscape = useGame((s) => s.setPseudoLandscape);
  const catalogEpoch = useGame((s) => s.catalogEpoch);
  const taps = useRef(0);
  const tapTimer = useRef(0);
  const [displayHint, setDisplayHint] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  void catalogEpoch;

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

  // 「全画面」 toggles pseudo-landscape (real Fullscreen API fails in Grok / many WebViews).
  const openDifficulty = () => {
    setDifficulty("normal");
    setPicking(true);
  };

  const confirmNewGame = () => {
    newGame(difficulty);
  };

  const onFullscreen = () => {
    const next = !pseudoLandscape;
    setPseudoLandscape(next);
    setDisplayHint(next ? "擬似横表示にした" : "擬似横表示を解除した");
  };

  if (picking) {
    return (
      <div className="relative flex h-full min-h-0 w-full overflow-hidden text-fg">
        <img
          src="/bg/title.jpg"
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/40" />
        <div className="relative flex h-full w-full items-center justify-center px-6 py-4">
          <div className="flex w-full max-w-xl flex-col items-center gap-4">
            <p className="text-[14px] tracking-[0.35em] text-brass">DIFFICULTY</p>
            <h2 className="font-display text-3xl">難易度を選ぶ</h2>
            <p className="max-w-md text-center text-sm text-muted">
              はじめからの難易度。あとから変更はできない（つづきからは保存値を使う）。
            </p>
            <div className="grid w-full grid-cols-3 gap-2">
              {DIFFICULTIES.map((id) => {
                const m = DIFFICULTY_META[id];
                const selected = difficulty === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDifficulty(id)}
                    className={cn(
                      "rounded-lg px-2 py-3 text-left hairline transition",
                      selected ? "bg-brass/25 text-fg" : "bg-surface/80 text-muted",
                    )}
                  >
                    <p className="font-display text-lg text-fg">{m.flavor}</p>
                    <p className="text-[15px] text-brass">（{m.plain}）</p>
                    <p className="mt-2 text-[14px] leading-snug text-faint">{m.blurb}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">選択中：{difficultyLabel(difficulty)}</p>
            <div className="flex gap-3">
              <GhostButton onClick={() => setPicking(false)} className="min-w-28">
                戻る
              </GhostButton>
              <PrimaryButton onClick={confirmNewGame} className="min-w-40">
                この難易度ではじめる
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden text-fg">
      <img
        src="/bg/title.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-bg/25" />
      {/* Title block hugs the logo width; the button area spans logo-right → stage-right
          (no right padding) and centers the column inside it. */}
      <div className="relative flex h-full w-full items-center py-8 pl-20">
        <div className="shrink-0">
          <p className="mb-2 text-[18px] tracking-[0.4em] text-brass">BANSHO JINKI</p>
          <h1
            className="font-display select-none text-[90px] leading-none tracking-wide drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
            onClick={onMark}
          >
            万象陣記
          </h1>
          {/* w-0: the copy lines overflow to the right without widening the title block,
              so the block's right edge stays at the logo's right edge. */}
          <div className="w-0">
            <p className="mt-5 w-max max-w-[620px] text-[18px] leading-relaxed text-fg/90 [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
              カードを集め、陣を敷き、地を取れ。属性の利を読んで覇を決する。
            </p>
            <p className="mt-2 w-max max-w-[620px] text-[15px] leading-relaxed text-muted [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
              スマホは横向き推奨。ホーム画面追加（PWA）だと横固定・全画面に近づきます。
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="flex w-[238px] shrink-0 flex-col gap-3">
            {hasExisting ? (
              <PrimaryButton
                onClick={() => continueGame()}
                className="h-[72px] text-[22px] tracking-widest"
              >
                つづきから
              </PrimaryButton>
            ) : null}
            {hasExisting ? (
              <GhostButton
                onClick={openDifficulty}
                className="h-[72px] text-[22px] tracking-widest"
              >
                はじめから
              </GhostButton>
            ) : (
              <PrimaryButton
                onClick={openDifficulty}
                className="h-[72px] text-[22px] tracking-widest"
              >
                はじめる
              </PrimaryButton>
            )}
            <GhostButton
              onClick={() => setHelp(true)}
              className="h-[72px] text-[22px] tracking-widest"
            >
              遊び方
            </GhostButton>
            <GhostButton
              onClick={() => void onFullscreen()}
              className="h-[72px] text-[22px] tracking-widest"
            >
              全画面
            </GhostButton>
            {displayHint ? (
              <p className="px-0.5 text-center text-[13px] leading-tight text-faint">
                {displayHint}
              </p>
            ) : null}
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  unlockDebug();
                }}
                className="debug-hit h-[44px] rounded-md text-[15px] text-faint"
              >
                内部
              </button>
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="h-[44px] whitespace-nowrap rounded-md text-[15px] text-muted"
              >
                マイデータ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
