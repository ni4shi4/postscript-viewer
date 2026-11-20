# postscript-viewer

ブラウザ上で PostScript（`.ps` / `.ps.gz`）を Ghostscript（WASM）により PDF に変換し、閲覧する Web アプリケーションです。変換処理はすべてクライアント側で行います。

## アーキテクチャ

1. ユーザーが `.ps` または `.ps.gz` を選択する
2. Web Worker 内で Ghostscript（WASM）が PDF に変換する
3. 出力した PDF を iframe で表示する

### ソース構成（Hexagonal / Ports and Adapters）

| 層 | パス | 役割 |
| --- | --- | --- |
| Application core | `src/core/` | ドメインの値と関数（今回は `domain/` の gzip 展開のみ） |
| Driving adapters | `src/adapters/driving/` | UI など、外部から core を駆動する側（`dom/viewer-ui.ts`） |
| Driven adapters | `src/adapters/driven/` | core が呼ぶ外部（`postscript-converter/`：Worker・Ghostscript WASM 変換） |
| Composition root | `src/main.ts` | 組み立てのみ（各層を import して配線する） |

**依存規則（`src/main.ts` を除く）**

- `src/core/**` は `src/adapters/**` を import しない。npm 依存は `pako` のみ（DOM・`Worker`・`ghostscript-wasm-esm` も不可）
- `src/adapters/driving/**` と `src/adapters/driven/**` は互いを import しない
- 同じ側の異なるアダプタディレクトリ同士も import しない

`npm run check:deps`（`npm run lint` にも含まれる）と、`.oxlintrc.json` の override で上記を検査します。

## 開発手順

開発・ビルド・コミットは、Linux 環境で asdf の shims が `PATH` に通っているシェルで行ってください。Node.js は `.tool-versions` に従い、`engines` の要件は 22.13.0 以上です。

1. [asdf](https://asdf-vm.com/) で `.tool-versions` に記載の Node.js（22.13.0 以上）を導入する
2. リポジトリ直下で `npm ci`（`prepare` が実行され、[Husky](https://typicode.github.io/husky/) による pre-commit フックが有効になる）
3. `npm run fetch:wasm`（`public/gs.wasm` を配置）
4. `npm run dev -- --host`（Vite 開発サーバー。`--host` で同一 LAN 上のブラウザからアクセス可能）
5. `npm test`（Vitest）
6. `npm run build`（本番ビルド）
7. 品質チェック: `npm run lint`、`npm run format:check`（自動整形は `npm run format`）

### Large E2E テスト（Playwright）

実ブラウザ（Chromium）と `public/gs.wasm` を使い、ビルド済みプレビュー上で PostScript 閲覧の回帰を検知します。

1. `npm run fetch:wasm` で `public/gs.wasm` を用意する
2. WSL2（Ubuntu）上で Chromium 用ブラウザを取得する（初回のみ）:

   ```bash
   npx playwright install chromium
   ```

   依存ライブラリが足りない場合は、Playwright が表示する `npx playwright install-deps chromium`（`sudo` が必要）を実行する。ディストリビューションによっては `libnss3`、`libatk-bridge2.0-0`、`libxkbcommon0` などが必要になる。

3. `npm run test:large`（内部で `vite build` のあと `vite preview` を起動してテストする）

`test-results/` と `playwright-report/` は生成物のため Git には含めません。

## ブラウザでの変換確認（W2）

1. `npm run fetch:wasm` で `public/gs.wasm` が存在することを確認する
2. `npm run dev -- --host` で Vite 開発サーバーを起動する
3. 表示された URL（例: `http://localhost:5173`）をブラウザで開く
4. 小さな `.ps` ファイルを選択する（ページ内のファイル入力）。変換が成功すると PDF が iframe に表示される
5. `.ps.gz` でも同様に選択して表示できること

`.ps.gz` の拡張子でも中身が gzip 形式でない場合、および zlib 形式（gzip マジックバイト `0x1f 0x8b` を持たない圧縮）は拒否されます。gzip で圧縮した PostScript を選んでください。

## gs.wasm サイズ（`ghostscript-wasm-esm` 1.0.1）

Ghostscript WASM は npm 依存 `ghostscript-wasm-esm` から `npm run fetch:wasm` で `public/gs.wasm` に配置する。Cloudflare Workers の静的アセットは 1 ファイル 25 MiB まで。

| 形式 | バイト数 |
| --- | ---: |
| raw | 16177271 |
| gzip (`gzip -9`) | 11212272 |
| brotli（Node `zlib.brotliCompressSync`、quality 11） | 10649239 |

## ライセンス

本リポジトリは [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）の下で公開されています。第三者コンポーネントの表記は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。