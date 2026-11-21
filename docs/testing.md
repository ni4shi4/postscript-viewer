# テスト戦略

## テスト分類

テストは **small** / **medium** / **large** の 3 段階に分かれます。

| 段階 | 対象 | 環境 | 目安（1 ケースあたり） | ファイル命名規則 |
| --- | --- | --- | --- | --- |
| small | Application core 中心（primary port を駆動し secondary port にフェイク） | Vitest。外部 I/O なし | 100 ms 未満 | `*.small.test.ts` |
| medium | アダプタ層の同一プロセス内結合（jsdom、フェイク `GhostscriptModule`、最小 WASM バイト列、`fetch` スタブなど） | Vitest。実wasm・実ブラウザは使わない | おおよそ 1 秒まで | `*.medium.test.ts` |
| large | 実物を使う検証（adapter 単独の変換と、ビルド済みプレビュー上の PostScript 閲覧） | 実 wasm（Vitest または Playwright） | 数秒〜数十秒 | `*.large.test.ts` |

large では `public/gs.wasm` と生成済みの `gs.mjs` が必要です。実行前に `npm run fetch:wasm`（通常）または `npm run build:wasm`（自前ビルド）で配置してください。手順は `docs/development.md` を参照してください。

## テスト実装時の原則

実装詳細に依存しないことを原則として以下に従ってください。

- 内部関数の呼び出し回数・引数・順序は検証せず、入力と観測できる出力（状態、ポート越しの結果、DOM の見え方）のみを検証する
- モックは外部境界に限り、自前モジュール同士はモックしない
- DOM 要素の特定には `data-testid` や role を用いる
