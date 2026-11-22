# 開発者向けドキュメント

## 前提

- Linux環境
- asdf
- Docker（自前ビルドする場合のみ必要）

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

1. `public/gs.wasm` と `src/generated/ghostscript/gs.mjs` を配置
    ```bash
    npm run fetch:wasm
    ```
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
3. `public/gs.wasm` と `src/generated/ghostscript/gs.mjs` を用意
    ```bash
    npm run fetch:wasm
    ```
4. playwright testの実行
    ```bash
    npm run test:large
    ```

### Ghostscript WASM の自前ビルド

1. Docker で自前ビルドして WASM を配置
    ```bash
    npm run build:wasm
    ```

### リリース成果物の作成

1. ビルド結果のハッシュが変わったときにハッシュファイルを更新
    ```bash
    sha256sum public/gs.wasm src/generated/ghostscript/gs.mjs > gs-wasm.sha256
    ```
2. `main` から Release を作成
    ```bash
    gh workflow run "Release Ghostscript WASM" --ref main
    ```
3. 取得元の Release タグを変えるときは、タグ設定を更新してからワークフローを実行