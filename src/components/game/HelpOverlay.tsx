import { useGame } from "@/game/store";
import { AffinityDiagram } from "./AffinityDiagram";

export function HelpOverlay() {
  const close = () => useGame.getState().setHelp(false);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 p-3">
      <div className="panel max-h-full w-full max-w-3xl overflow-y-auto rounded-xl p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg">遊び方</h2>
          <button type="button" onClick={close} className="h-9 px-3 text-sm text-muted">
            閉じる
          </button>
        </div>
        <div className="grid gap-4 text-sm leading-relaxed text-muted lg:grid-cols-2">
          <div className="space-y-2">
            <p>
              カードを集め、リーダーの<span className="text-fg">陣形</span>に配置し、隣り合う領地を奪う陣取りです。戦闘は自動。勝敗は編成で決まります。
            </p>
            <p>リーダーが倒れると敗北。相手リーダーを墜とすのも一つの手。</p>
            <p>
              <span className="text-fg">育成</span>で金か重複を使い、レベルを上げる。能力が伸びる。
            </p>
            <p>出陣前に敵の属性を見て組み直せ。戦闘中も下の「相性」から図を出せる。</p>
          </div>
          <div>
            <h3 className="mb-2 font-display text-fg">属性相性</h3>
            <AffinityDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}
