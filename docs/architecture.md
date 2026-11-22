
# アーキテクチャ

Hexagonal / Ports and Adaptersで構成されています。

## 層と役割

| 層 | パス | 役割 |
| --- | --- | --- |
| Application core | `src/core/` | `domain/`（値・エラー）、`ports/`（インターフェース）、`usecases/`（閲覧フロー）、`state/`（状態とストア） |
| Driving adapters | `src/adapters/driving/` | UI など、外部から core を駆動する側（画面のコンポーネントは `driving/dom` の Preact のみ） |
| Driven adapters | `src/adapters/driven/` | secondary port の実装 |
| Composition root | `src/main.ts` | コンポーネントの組み立て |

## 依存規則

`npm run check:deps`（もしくは、`npm run lint`）で検査されます。

- `src/core/**` は `src/adapters/**` を import しない。 `src/core/**`の npm 依存は `pako` のみ
- `src/adapters/driving/**` と `src/adapters/driven/**` は互いを import しない
- `src/adapters/driving` 配下のディレクトリ同士は互いを import しない
- `src/adapters/driven` 配下のディレクトリ同士は互いを import しない


