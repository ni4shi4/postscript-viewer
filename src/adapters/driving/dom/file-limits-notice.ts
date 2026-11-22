import { acceptedFileLimitsDescription } from "./limit-display-text";

export function queryFileLimitsNoticeElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-file-limits]");
  if (element === null) {
    throw new Error("File limits notice element is missing");
  }
  return element;
}

export function applyFileLimitsNotice(): void {
  queryFileLimitsNoticeElement().textContent = acceptedFileLimitsDescription();
}
