# Third-Party Notices

本プロジェクトの配布物に同梱される実行時依存は、以下の第三者ソフトウェアです。

## Ghostscript

| 項目 | 内容 |
| --- | --- |
| ライセンス | GNU Affero General Public License v3.0（AGPL-3.0）および Artifex Software, Inc. による商用ライセンス（デュアルライセンス） |
| 入手元 | npm パッケージ [`ghostscript-wasm-esm`](https://www.npmjs.com/package/ghostscript-wasm-esm) 1.0.1（[sharevb/ghostscript-wasm-esm](https://github.com/sharevb/ghostscript-wasm-esm)） |

ビルド時に `public/gs.wasm` として配置し、ブラウザ上で WebAssembly として読み込みます。

## pako

| 項目 | 内容 |
| --- | --- |
| ライセンス | [The MIT License](https://opensource.org/licenses/MIT) および Zlib License（`node_modules/pako/package.json` の `license` フィールド: `(MIT AND Zlib)`。MIT の全文は同パッケージの `LICENSE` を参照） |
| 入手元 | npm パッケージ [`pako`](https://www.npmjs.com/package/pako) 3.0.3（[nodeca/pako](https://github.com/nodeca/pako)） |

`.ps.gz` の gzip 展開に使用します。