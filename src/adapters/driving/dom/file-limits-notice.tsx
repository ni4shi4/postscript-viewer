import { useMessages } from "./i18n/messages-context";
import { acceptedFileLimitItems } from "./limit-display-text";

export function FileLimitsNotice() {
  const messages = useMessages();
  const items = acceptedFileLimitItems(messages);

  return (
    <dl
      id="file-limits-notice"
      class="file-limits-notice"
      data-file-limits
      data-testid="file-limits-notice"
      aria-label={messages.limitsNoticeLabel}
    >
      {items.map((item) => (
        <div key={item.label} class="chip">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
