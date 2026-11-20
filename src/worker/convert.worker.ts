import type {
  ConvertFailureMessage,
  ConvertSuccessMessage,
  MainToWorkerMessage,
} from "./messages";

export const GS_PDF_DEVICE = "-sDEVICE=pdfwrite" as const;
export const GS_NO_PAUSE = "-dNOPAUSE" as const;
export const GS_BATCH = "-dBATCH" as const;

const GS_PDFWRITE_ARGS = [GS_PDF_DEVICE, GS_NO_PAUSE, GS_BATCH] as const;

async function convertPostScriptToPdf(
  _postScript: Uint8Array,
): Promise<Uint8Array> {
  void GS_PDFWRITE_ARGS;
  // TODO: Load Ghostscript WASM, write input to the virtual FS, and run
  //       gs with -sOutputFile=output.pdf input.ps using GS_PDFWRITE_ARGS.
  throw new Error("Ghostscript conversion is not implemented yet");
}

function postFailure(id: string, error: string): void {
  const message: ConvertFailureMessage = { type: "failure", id, error };
  self.postMessage(message);
}

function postSuccess(id: string, pdf: Uint8Array): void {
  const message: ConvertSuccessMessage = { type: "success", id, pdf };
  self.postMessage(message, [pdf.buffer]);
}

async function handleConvert(message: MainToWorkerMessage): Promise<void> {
  if (message.type !== "convert") {
    return;
  }

  try {
    const pdf = await convertPostScriptToPdf(message.postScript);
    postSuccess(message.id, pdf);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    postFailure(message.id, error);
  }
}

self.addEventListener("message", (event: MessageEvent<MainToWorkerMessage>) => {
  void handleConvert(event.data);
});