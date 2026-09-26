# 実装レビュー依頼（編成・レイアウト・戦闘）

別アシスタント向け。このリポジトリは **ゲーム本体**。  
カタログ差し替え用の [`sbmmr596/bansho-jinki`](https://github.com/sbmmr596/bansho-jinki) は対象外。

## 目的

1. **編成 UI**（リーダー／スロット／トレイ／コスト上限）が直感的か、破綻していないか
2. **16:9 固定レイアウト**（縦持ち回転、ノッチ、はみ出し）が実機・ブラウザで持つか
3. **戦闘**（ATB 風ゲージ、陣形、攻撃範囲、テスト戦闘の補充ルール）が意図どおりか

## スタック

- React 19 / TanStack Start / Zustand
- 画面は DOM。Canvas ではない
- セーブは `localStorage`（`src/game/save.ts`）
- カタログ上書き: Drive（`src/game/drive-catalog.ts`）

## 起動後の操作

タイトル → はじめる → 始原の社。  
編成は宮殿ナビから。テスト戦闘はデバッグ（タイトル「万象陣記」を連打、または「内部」）。

## 見るファイル

### 編成

- `src/components/game/FormationScreen.tsx` — 9 マス、トレイ、リーダー入れ替え
- `src/game/store.ts` — `placeCard` / `setLeader`（リーダー外すと全員解除）
- `src/game/data.ts` — `FORMATIONS`、コスト、属性
- `src/game/combat.ts` — `formationOfLeader`

リーダー所属で陣形が決まる。コスト超過は出陣不可。  
ユーザー指摘の経緯: 選択方法の見直し、リーダー解除で全員解除、入れ替え効率。

参考スクショ: `docs/qa/qa-formation.png` `docs/qa/qa-form-phone.png`  
`docs/feedback/IMG_3676.jpg` `docs/feedback/IMG_3681.jpg`

### レイアウト

- `src/components/game/GameApp.tsx` — `fit()`（visualViewport + 16:9 + 縦なら rotate 90）
- `src/styles.css` — `--sat/--sar/--sab/--sal`、`.game-frame` / `.game-stage`
- `src/routes/__root.tsx` — viewport `user-scalable=no` `viewport-fit=cover`
- `src/components/game/pieces.tsx` — `Shell`、カード、長押し拡大

制約: メイン画面外は黒帯ではなくタイトル背景。操作ボタンがノッチで隠れないこと（右側寄せの経緯あり）。

参考: `docs/qa/qa-viewport-16-9.png` `docs/qa/qa-viewport-phone.png` `docs/qa/qa-full-phone.png`  
`docs/feedback/IMG_3703.jpg` `docs/feedback/IMG_3704.jpg` `docs/feedback/IMG_3675.jpg`

### 戦闘

- `src/game/combat.ts` — シミュレーション、範囲（単体 / 縦 / 全体）、属性相性
- `src/components/game/BattleView.tsx` — フィールド描画、ATB レール、エフェクト
- `src/game/trial.ts` — テスト戦闘（雑魚列前進、ネームド上限、撃破回復）
- `src/game/store.ts` — `startBattle` / `finishBattle` / 速度

意図している挙動:

- 味方右・敵左。敵フィールド MAX 5
- ATB: 全キャラの印がスタート→ゴール。ゴールしたキャラが行動中は全体停止。終わったらスタートへ
- 行動順は速度。ヘイスト / スロウ雑魚が稀に出る
- テスト戦闘: 列が 0 になるまで隙間があっても補充しない。最後尾から。ネームドは 500 撃破まで同時 1、以降 500 毎に上限+1。50 撃破で自軍 15% 回復
- エフェクトはコンパクト（単体は 1 体分、縦横全体は 3 体分）

参考: `docs/qa/qa-battle.png` `docs/feedback/IMG_3682.jpg` `docs/feedback/IMG_3682 Copy.jpg`

## 既知の残り

- 槍騎マキ・呪術士ヴェルの全身 PNG にグリーンスクリーン残り（`docs/feedback/IMG_3708.jpg` `IMG_3709.jpg`）
- 本番プレビューの PGLite wasm 同梱はローカル Vite では問題にならないことが多い

## やってほしくないこと

- `sbmmr596/bansho-jinki` へ標準データをダンプしない
- 画風をセル塗り・クロ基準の等身から大きく外さない
- 16:9 contain-fit をやめて伸び縮みレイアウトに戻さない
