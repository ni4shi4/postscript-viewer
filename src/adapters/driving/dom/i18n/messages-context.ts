import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { en } from "./en";
import { ja } from "./ja";
import type { Locale, Messages } from "./messages";

const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  ja,
  en,
};

export function messagesFor(locale: Locale): Messages {
  return MESSAGES_BY_LOCALE[locale];
}

export const MessagesContext = createContext<Messages>(ja);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}
