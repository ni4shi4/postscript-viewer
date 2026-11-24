import { useState } from "preact/hooks";

const STORAGE_KEY = "history-sidebar-open";

function readStoredOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeStoredOpen(open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // 保存できない環境では、このセッション内の状態だけで動作する。
  }
}

export function useHistorySidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(readStoredOpen);
  return [
    open,
    (next) => {
      setOpen(next);
      writeStoredOpen(next);
    },
  ];
}
