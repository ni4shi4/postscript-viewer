import { acceptedFileLimitsDescription } from "./limit-display-text";

export function FileLimitsNotice() {
  return (
    <p
      id="file-limits-notice"
      class="file-limits-notice"
      data-file-limits
      data-testid="file-limits-notice"
    >
      {acceptedFileLimitsDescription()}
    </p>
  );
}
