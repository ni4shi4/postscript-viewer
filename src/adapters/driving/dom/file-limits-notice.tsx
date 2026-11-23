import { acceptedFileLimitItems } from "./limit-display-text";

export function FileLimitsNotice() {
  const items = acceptedFileLimitItems();

  return (
    <dl
      id="file-limits-notice"
      class="file-limits-notice"
      data-file-limits
      data-testid="file-limits-notice"
    >
      {items.flatMap((item) => [
        <dt key={`${item.label}-term`}>{item.label}</dt>,
        <dd key={`${item.label}-value`}>{item.value}</dd>,
      ])}
    </dl>
  );
}
