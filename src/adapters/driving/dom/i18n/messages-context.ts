import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { ja } from "./ja";
import type { Locale, Messages } from "./messages";

const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  ja,
  // 英語の辞書を追加するまでは日本語を返す。
  en: ja,
};

export function messagesFor(locale: Locale): Messages {
  return MESSAGES_BY_LOCALE[locale];
}

export const MessagesContext = createContext<Messages>(ja);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}
