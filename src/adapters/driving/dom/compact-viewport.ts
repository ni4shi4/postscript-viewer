import { useEffect, useState } from "preact/hooks";

// CSS の @media (max-width: 480px) と同じ境界。ドロワーなど DOM 構造が変わる部分だけ JS で判定する。
const COMPACT_VIEWPORT_QUERY = "(max-width: 480px)";

function compactViewportQuery(): MediaQueryList | undefined {
  if (typeof window.matchMedia !== "function") {
    return undefined;
  }
  return window.matchMedia(COMPACT_VIEWPORT_QUERY);
}

// 初回描画から正しい値を返す（クライアント描画のみのため、初期値で PC 表示を挟まずちらつかない）。
export function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(() => compactViewportQuery()?.matches ?? false);

  useEffect(() => {
    const query = compactViewportQuery();
    if (query === undefined) {
      return;
    }
    const sync = (): void => {
      setCompact(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
    };
  }, []);

  return compact;
}
