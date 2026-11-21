import { formattedByteLimit, type ByteLimitKind } from "../../../core/domain/limits";
import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { selectedViewerDocument } from "../../../core/state/viewer-state";

const STATUS_PROGRESS_CLASS = "viewer-status--progress";
const STATUS_ERROR_CLASS = "viewer-status--error";

const CONVERTING_MESSAGE = "PostScript を PDF に変換しています…";

export type ViewerDom = {
  fileInput: HTMLInputElement;
  pdfFrame: HTMLIFrameElement;
  statusPanel: HTMLParagraphElement;
};

export function queryViewerDom(): ViewerDom {
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  const pdfFrame = document.querySelector<HTMLIFrameElement>("iframe");
  const statusPanel = document.querySelector<HTMLParagraphElement>("[data-viewer-status]");

  if (fileInput === null || pdfFrame === null || statusPanel === null) {
    throw new Error("Required page elements are missing");
  }

  return { fileInput, pdfFrame, statusPanel };
}

function clearStatusPanel(statusPanel: HTMLParagraphElement): void {
  statusPanel.classList.remove(STATUS_PROGRESS_CLASS, STATUS_ERROR_CLASS);
  statusPanel.textContent = "";
  statusPanel.hidden = true;
}

function presentConvertingStatus(statusPanel: HTMLParagraphElement): void {
  clearStatusPanel(statusPanel);
  statusPanel.hidden = false;
  statusPanel.textContent = CONVERTING_MESSAGE;
  statusPanel.classList.add(STATUS_PROGRESS_CLASS);
}

function userMessageForNotGzipError(): string {
  return "gzip 形式ではありません。.gz ファイルは gzip 圧縮された PostScript を選んでください";
}

function userMessageForTooLargeLimit(limit: ByteLimitKind): string {
  const formatted = formattedByteLimit(limit);
  if (limit === "input") {
    return `ファイルサイズが上限（${formatted}）を超えています`;
  }
  return `展開後のサイズが上限（${formatted}）を超えています`;
}

function userMessageFromViewerError(error: ViewerError): string {
  switch (error.kind) {
    case "not-gzip":
      return userMessageForNotGzipError();
    case "too-large":
      return userMessageForTooLargeLimit(error.limit);
    case "conversion-failed":
      return error.detail;
  }
}

function presentErrorStatus(statusPanel: HTMLParagraphElement, message: string): void {
  clearStatusPanel(statusPanel);
  statusPanel.hidden = false;
  statusPanel.textContent = message;
  statusPanel.classList.add(STATUS_ERROR_CLASS);
}

function renderViewerStatus(dom: ViewerDom, state: ViewerState): void {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument === undefined) {
    clearStatusPanel(dom.statusPanel);
    return;
  }

  switch (viewerDocument.status.kind) {
    case "converting":
      presentConvertingStatus(dom.statusPanel);
      return;
    case "ready":
      clearStatusPanel(dom.statusPanel);
      return;
    case "error":
      presentErrorStatus(dom.statusPanel, userMessageFromViewerError(viewerDocument.status.error));
      return;
    default: {
      const unreachable: never = viewerDocument.status;
      return unreachable;
    }
  }
}

export function resetFileInputSelection(fileInput: HTMLInputElement): void {
  fileInput.value = "";
}

export function startViewerDomUi(dom: ViewerDom, app: ViewerApp): void {
  let lastLoggedErrorKey: string | undefined;

  app.subscribe((state) => {
    const viewerDocument = selectedViewerDocument(state);
    renderViewerStatus(dom, state);

    if (viewerDocument?.status.kind === "error") {
      const message = userMessageFromViewerError(viewerDocument.status.error);
      const errorKey = `${viewerDocument.id}:${message}`;
      if (lastLoggedErrorKey !== errorKey) {
        console.error(message);
        lastLoggedErrorKey = errorKey;
      }
      return;
    }

    lastLoggedErrorKey = undefined;
  });

  dom.fileInput.addEventListener("change", () => {
    const file = dom.fileInput.files?.[0];
    if (file === undefined) {
      return;
    }

    void (async () => {
      const data = new Uint8Array(await file.arrayBuffer());
      await app.openPostScript({ fileName: file.name, data });
    })().finally(() => {
      resetFileInputSelection(dom.fileInput);
    });
  });
}
