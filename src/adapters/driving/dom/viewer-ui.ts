const STATUS_PROGRESS_CLASS = "viewer-status--progress";
const STATUS_ERROR_CLASS = "viewer-status--error";

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

function clearStatusPresentation(statusPanel: HTMLParagraphElement): void {
  statusPanel.classList.remove(STATUS_PROGRESS_CLASS, STATUS_ERROR_CLASS);
  statusPanel.textContent = "";
  statusPanel.hidden = true;
}

export function presentConverting(dom: ViewerDom): void {
  clearStatusPresentation(dom.statusPanel);
  dom.statusPanel.hidden = false;
  dom.statusPanel.textContent = "PostScript を PDF に変換しています…";
  dom.statusPanel.classList.add(STATUS_PROGRESS_CLASS);
  dom.pdfFrame.hidden = true;
  dom.pdfFrame.removeAttribute("src");
}

export function presentConversionError(dom: ViewerDom, message: string): void {
  clearStatusPresentation(dom.statusPanel);
  dom.statusPanel.hidden = false;
  dom.statusPanel.textContent = message;
  dom.statusPanel.classList.add(STATUS_ERROR_CLASS);
  dom.pdfFrame.hidden = true;
  dom.pdfFrame.removeAttribute("src");
}

export function presentPdfInFrame(dom: ViewerDom, objectUrl: string): void {
  clearStatusPresentation(dom.statusPanel);
  dom.pdfFrame.hidden = false;
  dom.pdfFrame.src = objectUrl;
}

export function resetFileInputSelection(fileInput: HTMLInputElement): void {
  fileInput.value = "";
}
