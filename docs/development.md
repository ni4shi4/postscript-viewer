# 開発者向けドキュメント

## 前提

- Linux環境
- asdf
- Docker（`npm run build:wasm` 用）

## Ghostscript WASM の取得

| コマンド | 用途 |
| --- | --- |
| `npm run fetch:wasm` | GitHub Release から `gs.wasm` と `gs.mjs` を取得し、`gs-wasm.sha256` で検証して配置する。Docker が使えない環境や、通常のローカル開発・デプロイビルド向け。 |
| `npm run build:wasm` | Docker で自前ビルドし、同じ検証を行って配置する。WASM を更新するときや、Release 用成果物の用意向け。 |

### リリース成果物の作成（手動）

1. `npm run build:wasm` で成果物を生成する。
2. 生成物が `gs-wasm.sha256` と一致することを確認する。Ghostscript やビルド設定を更新してハッシュが変わった場合は、配置後のファイルから `gs-wasm.sha256` を書き換える。
    ```bash
    sha256sum public/gs.wasm src/generated/ghostscript/gs.mjs > gs-wasm.sha256
    ```
3. タグ `gs-wasm-v1` の GitHub Release に `gs.wasm` と `gs.mjs` を添付する。
4. タグを変えるときは、`fetch:wasm` の取得元（Release タグ）も合わせて更新する。

## 開発手順

### 事前準備

1. [asdf](https://asdf-vm.com/) で必要なツールをインストール
    ```bash
    asdf install
    ```
2. `prepare` の実行 ([Husky](https://typicode.github.io/husky/) による pre-commit フックの有効化)
    ```bash
    npm ci
    ```

### ローカルでの画面確認

1. `public/gs.wasm` と `src/generated/ghostscript/gs.mjs` を配置する（通常は `npm run fetch:wasm`。自前ビルドしたい場合は `npm run build:wasm`）。
2. Vite 開発サーバーのホスト
    ```bash
    npm run dev -- --host
    ```
3. 表示された URL（例: `http://localhost:5173`）をブラウザで開く

### 品質チェック

vitest(small + medium)の実行
```bash
npm test
```

adapter 単独 large（実 Ghostscript WASM）の実行
```bash
npm run build:wasm
# または npm run fetch:wasm
npm run test:large:adapter
```

リンターとフォーマッターの実行
```bash
npm run lint
npm run format:check
```

### ビルド

```bash
npm run build
```

### Playwright test(large)の実行

1. （初回のみ）Chromium 用ブラウザを取得する
    ```bash
    npx playwright install chromium
    ```
2. （初回のみ）Playwright に必要なライブラリを追加する
    ```bash
    npx playwright install-deps chromium
    ```
3. `public/gs.wasm` と `src/generated/ghostscript/gs.mjs` を用意する（通常は `npm run fetch:wasm`。自前ビルドしたい場合は `npm run build:wasm`）。
4. playwright testの実行
    ```bash
    npm run test:large
    ```
