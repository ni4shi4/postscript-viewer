import { useMessages } from "./i18n/messages-context";
import { sourceRepositoryUrl } from "../../../core/domain/source-repository-url";

export type AppFooterProps = {
  commitSha?: string;
};

export function AppFooter({ commitSha }: AppFooterProps) {
  const messages = useMessages();
  return (
    <>
      <a href={sourceRepositoryUrl(commitSha)} rel="noopener noreferrer">
        {messages.sourceCodeLink}
      </a>
      <span class="app-footer__sep" aria-hidden="true">
        ·
      </span>
      <span>AGPL-3.0</span>
      <span class="app-footer__sep" aria-hidden="true">
        ·
      </span>
      <a
        href={messages.alternateLanguage.href}
        hrefLang={messages.alternateLanguage.lang}
        lang={messages.alternateLanguage.lang}
      >
        {messages.alternateLanguage.label}
      </a>
    </>
  );
}
