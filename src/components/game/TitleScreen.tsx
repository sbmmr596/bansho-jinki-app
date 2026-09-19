import { useRef, useState } from "react";
import { CARD_BY_ID } from "@/game/data";
import { DIFFICULTIES, DIFFICULTY_META, difficultyLabel } from "@/game/difficulty";
import { useGame } from "@/game/store";
import type { Difficulty } from "@/game/types";
import { requestGameDisplay } from "@/lib/display-mode";
import { cn } from "@/lib/utils";
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
  const [displayHint, setDisplayHint] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

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

  // Fullscreen is only via the dedicated 「全画面」 button.
  // Calling requestGameDisplay (toggle) on start was flipping fullscreen and
  // could drop local picking state / feel like start did nothing but toggle.
  const openDifficulty = () => {
    setDifficulty("normal");
    setPicking(true);
  };

  const confirmNewGame = () => {
    newGame(difficulty);
  };

  const onFullscreen = async () => {
    const result = await requestGameDisplay(
      document.querySelector(".game-frame") as HTMLElement | null,
    );
    if (result.mode === "entered") {
      setDisplayHint("全画面にした");
    } else if (result.mode === "exited") {
      setDisplayHint("全画面を解除した");
    } else {
      setDisplayHint(result.reason ?? "このブラウザでは制限あり（PWA推奨）");
    }
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
            <p className="text-[10px] tracking-[0.35em] text-brass">DIFFICULTY</p>
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
                    <p className="text-[11px] text-brass">（{m.plain}）</p>
                    <p className="mt-2 text-[10px] leading-snug text-faint">{m.blurb}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">選択中：{difficultyLabel(difficulty)}</p>
            <div className="flex gap-3">
              <GhostButton onClick={() => setPicking(false)} className="h-11 min-w-28">
                戻る
              </GhostButton>
              <PrimaryButton onClick={confirmNewGame} className="h-11 min-w-36">
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
      <div className="relative flex h-full w-full items-center justify-center px-6 py-3">
        <div className="flex max-w-4xl items-center gap-5">
          <div className="min-w-0 max-w-md">
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
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-faint">
              スマホは横向き推奨。ホーム画面追加（PWA）だと横固定・全画面に近づきます。
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
              <PrimaryButton onClick={() => continueGame()} className="h-11">
                つづきから
              </PrimaryButton>
            ) : null}
            {hasExisting ? (
              <GhostButton onClick={openDifficulty} className="h-11">
                はじめから
              </GhostButton>
            ) : (
              <PrimaryButton onClick={openDifficulty} className="h-11">
                はじめる
              </PrimaryButton>
            )}
            <GhostButton onClick={() => void onFullscreen()} className="h-11">
              全画面
            </GhostButton>
            {displayHint ? (
              <p className="px-0.5 text-center text-[10px] leading-tight text-faint">{displayHint}</p>
            ) : null}
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
    </div>
  );
}
