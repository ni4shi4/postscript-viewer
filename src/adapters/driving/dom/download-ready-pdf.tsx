import { pdfDownloadFileName } from "../../../core/domain/pdf-download-file-name";
import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerState } from "../../../core/state/viewer-state";
import { selectedViewerDocument } from "../../../core/state/viewer-state";

export function downloadReadyPdfVisible(state: ViewerState): boolean {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument === undefined) {
    return false;
  }
  return viewerDocument.status.kind === "ready";
}

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

export function DownloadReadyPdf({
  app,
  state,
}: {
  app: ViewerApp | undefined;
  state: ViewerState;
}) {
  const hidden = app === undefined || !downloadReadyPdfVisible(state);
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
      const downloadName = pdfDownloadFileName(ready.fileName);
      triggerBrowserPdfDownload(ready.pdf, downloadName);
    })();
  };

  return (
    <button
      type="button"
      class="file-picker__button"
      data-testid="download-pdf"
      hidden={hidden}
      onClick={onDownload}
    >
      PDF をダウンロード
    </button>
  );
}
