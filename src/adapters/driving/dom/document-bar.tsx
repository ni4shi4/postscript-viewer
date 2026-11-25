import type { ComponentChildren } from "preact";
import { pdfDownloadFileName } from "../../../core/domain/pdf-download-file-name";
import type { ViewerApp } from "../../../core/ports/viewer-app";
import { selectedViewerDocument, type ViewerState } from "../../../core/state/viewer-state";

function triggerBrowserPdfDownload(pdf: Uint8Array, downloadName: string): void {
  const blob = new Blob([Uint8Array.from(pdf)], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = downloadName;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function BarIcon({ children }: { children: ComponentChildren }) {
  return (
    <svg
      class="document-bar__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DocumentBar({
  app,
  state,
  hidden,
}: {
  app: ViewerApp | undefined;
  state: ViewerState;
  hidden: boolean;
}) {
  const fileName = selectedViewerDocument(state)?.fileName ?? "";
  const selectedDocumentId = state.selectedDocumentId;

  const onDownload = (): void => {
    if (app === undefined || selectedDocumentId === undefined) {
      return;
    }
    void (async () => {
      const ready = await app.readReadyPdf(selectedDocumentId);
      if (ready === undefined) {
        return;
      }
      triggerBrowserPdfDownload(ready.pdf, pdfDownloadFileName(ready.fileName));
    })();
  };

  return (
    <div class="document-bar" data-testid="document-bar" hidden={hidden}>
      <BarIcon>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </BarIcon>
      <span class="document-bar__name" data-testid="document-bar-file-name" title={fileName}>
        {fileName}
      </span>
      <button
        type="button"
        class="document-bar__button"
        data-testid="download-pdf"
        aria-label={`${pdfDownloadFileName(fileName)} をダウンロード`}
        onClick={onDownload}
      >
        <BarIcon>
          <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
        </BarIcon>
        ダウンロード
      </button>
    </div>
  );
}
