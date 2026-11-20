import type { PdfViewer } from "../../../core/ports/pdf-viewer";

export type IframePdfViewerDom = {
  pdfFrame: HTMLIFrameElement;
};

export function createIframePdfViewer(dom: IframePdfViewerDom): PdfViewer {
  let activePdfObjectUrl: string | undefined;

  const revokeActivePdfObjectUrl = (): void => {
    if (activePdfObjectUrl === undefined) {
      return;
    }
    URL.revokeObjectURL(activePdfObjectUrl);
    activePdfObjectUrl = undefined;
  };

  return {
    show(pdf) {
      revokeActivePdfObjectUrl();
      const blob = new Blob([Uint8Array.from(pdf)], {
        type: "application/pdf",
      });
      activePdfObjectUrl = URL.createObjectURL(blob);
      dom.pdfFrame.hidden = false;
      dom.pdfFrame.src = activePdfObjectUrl;
    },
    clear() {
      revokeActivePdfObjectUrl();
      dom.pdfFrame.hidden = true;
      dom.pdfFrame.removeAttribute("src");
    },
  };
}
