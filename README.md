# postscript-viewer

ブラウザ上で PostScript（`.ps` / `.ps.gz`）を Ghostscript（WASM）により PDF に変換し、閲覧する Web アプリケーションです。変換処理はすべてクライアント側で行います。

## アーキテクチャ

1. ユーザーが `.ps` または `.ps.gz` を選択する
2. Web Worker 内で Ghostscript（WASM）が PDF に変換する
3. 出力した PDF を iframe（または pdf.js）で表示する

## 開発手順

1. [asdf](https://asdf-vm.com/) で `.tool-versions` に記載の Node.js を導入する
2. `npm install`
3. `npm run fetch:wasm`
4. `npm run dev`（開発サーバー）
5. `npm run build`（本番ビルド）

## ライセンス

本リポジトリは [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）の下で公開されています。
