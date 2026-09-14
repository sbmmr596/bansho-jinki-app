# 万象陣記（ゲーム本体）

神羅万象フロンティア風の横画面 16:9 カード／タクティクス。  
React 19 + TanStack Start + Zustand + Tailwind v4。

| リポジトリ | 役割 |
|---|---|
| **このリポジトリ** `bansho-jinki-app` | ゲーム本体（コード・標準アセット・設定） |
| [`sbmmr596/bansho-jinki`](https://github.com/sbmmr596/bansho-jinki) | キャラ差し替え用（`chars.json` と差し替え画像だけ） |

差し替えカタログ側は触らないこと。本体のレビュー・改修はここ。

## 起動

```bash
npm install
npm run dev
```

`0.0.0.0:8080`。型チェック / 本番ビルド:

```bash
npm run typecheck
npm run build
```

認証は Grok ゲート前提。ローカルでは標準データだけで遊べる。Google ドライブ／GitHub カタログは任意。

## レビューしてほしい箇所

特に **編成 UI・16:9 レイアウト・戦闘**。詳細は [REVIEW.md](./REVIEW.md)。

| 領域 | 主なファイル |
|---|---|
| 編成 | `src/components/game/FormationScreen.tsx` `src/game/store.ts` `src/game/data.ts` |
| 画面フィット | `src/components/game/GameApp.tsx` `src/styles.css` |
| 戦闘 | `src/game/combat.ts` `src/components/game/BattleView.tsx` `src/game/trial.ts` |
| カード描画 | `src/components/game/pieces.tsx` |
| マップ | `src/components/game/MapScreen.tsx` |

ユーザー実機スクショ: `docs/feedback/`  
QA スチル: `docs/qa/`

## データ

- 標準カタログ: `public/data/chars.json` + `src/game/data.ts` のフォールバック
- 全身: `public/chars/{id}.png`（カード・戦場）
- バスト: `public/cards/{id}.jpg`（ATB レールなど）
- ユーザー JSON の `art` が `/chars/…` なら標準絵。相対パス `chars/id.png` なら Drive / GitHub 側

## 注意

- 画面は **16:9 contain-fit**。縦持ちは `rotate(90deg)` で横画面相当
- iPhone ノッチは `env(safe-area-inset-*)`
- 戦闘は味方が右、敵が左。マップは右から進む
- Grok App Builder 由来の足場（`scripts/grok-pwa-*`, `public/__grok`, `src/lib/auth`）が残っている
