# postscript-viewer

ブラウザ上で PostScript（`.ps` / `.ps.gz`）を Ghostscript（WASM）により PDF に変換し、閲覧する Web アプリケーションです。変換処理はすべてクライアント側で行います。

## アーキテクチャ

1. ユーザーが `.ps` または `.ps.gz` を選択する
2. Web Worker 内で Ghostscript（WASM）が PDF に変換する
3. 出力した PDF を iframe（または pdf.js）で表示する

## 開発手順

1. [asdf](https://asdf-vm.com/) で `.tool-versions` に記載の Node.js を導入する
2. `npm install`（`prepare` が実行され、[Husky](https://typicode.github.io/husky/) による pre-commit フックが有効になる）
3. `npm run fetch:wasm`
4. `npm run dev`（開発サーバー）
5. `npm run build`（本番ビルド）
6. `npm run lint`
7. `npm run format`

コミットは、asdf の shims が `PATH` に通っている WSL 上のシェルで行ってください。Windows 側の git / Node.js / npm は使わないでください。

## gs.wasm サイズ（`ghostscript-wasm-esm` 1.0.1）

Ghostscript WASM は npm 依存 `ghostscript-wasm-esm` から `npm run fetch:wasm` で `public/gs.wasm` に配置する。Cloudflare Workers の静的アセットは 1 ファイル 25 MiB まで。

| 形式 | バイト数 |
| --- | ---: |
| raw | 16177271 |
| gzip (`gzip -9`) | 11212272 |
| brotli（Node `zlib.brotliCompressSync`、quality 11） | 10649239 |

## ライセンス

本リポジトリは [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）の下で公開されています。
