import { CARD_BY_ID } from "@/game/data";
import { useGame } from "@/game/store";
import { CardFace, PrimaryButton, Shell } from "./pieces";

export function ResultScreen() {
  const result = useGame((s) => s.result);
  const captured = useGame((s) => s.captured);
  const afterResult = useGame((s) => s.afterResult);
  if (!result) return null;
  const win = result.winner === "player";
  const card = result.cardGain ? CARD_BY_ID[result.cardGain] : null;
  const capital = captured.includes("capital") && win;

  return (
    <Shell
      title={
        result.trial
          ? "試し撃ち"
          : result.arena
            ? "闘技場"
            : win
              ? "勝利"
              : result.winner === "draw"
                ? "引き分け"
                : "敗北"
      }
      wide
    >
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="flex max-w-3xl items-center gap-8">
          <div className="min-w-0 max-w-md">
            <p className="font-display text-3xl text-fg">
              {result.trial
                ? result.winner === "player"
                  ? "試し撃ち 終了"
                  : "全滅"
                : result.arena
                  ? win
                    ? result.nodeName + " 勝利"
                    : result.winner === "draw"
                      ? "引き分け"
                      : result.nodeName + " 敗北"
                  : capital
                    ? "帝都制覇"
                    : win
                      ? result.nodeName + " を奪取"
                      : "撤退した"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {result.trial
                ? `${result.kills ?? 0}体撃破`
                : result.reason === "leader"
                  ? win
                    ? "敵リーダーを墜とした。"
                    : "リーダーが倒れた。"
                  : result.reason === "wipe"
                    ? win
                      ? "敵を殲滅した。"
                      : "味方が潰えた。"
                    : "時間切れ。残存で決した。"}
            </p>
            {result.trial ? (
              <p className="mt-4 text-sm text-muted">
                {result.winner === "player" ? "終了した。" : "味方が潰えた。"}
              </p>
            ) : result.arena ? (
              win ? (
                <div className="mt-4 space-y-1 text-sm">
                  <p className="text-brass tabular">+{result.goldGain} 金</p>
                  <p className="text-muted">消費した闘気は戻らない。報酬の金を受け取った。</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">闘気を消費した。再挑戦するか本拠へ戻れ。</p>
              )
            ) : win ? (
              <div className="mt-4 space-y-1 text-sm">
                <p className="text-brass tabular">+{result.goldGain} 金</p>
                {result.leveled.length ? (
                  <p className="text-muted">出陣したカードのレベルが上がった。</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">編成と属性を見直して、再攻せよ。</p>
            )}
            <PrimaryButton onClick={afterResult} className="mt-5 h-10 min-w-36">
              {result.arena ? "闘技場へ" : result.trial || capital ? "本拠へ" : "地図へ"}
            </PrimaryButton>
          </div>
          {win && card ? (
            <div className="shrink-0">
              <p className="mb-2 text-xs text-muted">
                {result.cardWasNew ? "新たなカード" : "カード強化"}
              </p>
              <CardFace card={card} size="md" />
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
