import { acceptedFileLimitItems } from "./limit-display-text";

export function FileLimitsNotice() {
  const items = acceptedFileLimitItems();

  return (
    <dl
      id="file-limits-notice"
      class="file-limits-notice"
      data-file-limits
      data-testid="file-limits-notice"
      aria-label="受け付ける上限"
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
