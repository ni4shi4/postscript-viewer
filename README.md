# postscript-viewer

ブラウザ上で PostScript（`.ps` / `.ps.gz`）を Ghostscript（WASM）により PDF に変換し、閲覧する Web アプリケーションです。変換処理はすべてクライアント側で行います。

## ライセンス

本リポジトリは [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）の下で公開されています。

クライアント側の PDF 描画には `pdfjs-dist`（Mozilla pdf.js、[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)）を使用します。
