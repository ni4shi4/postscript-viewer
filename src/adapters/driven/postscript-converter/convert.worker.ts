import { convertPostScriptToPdf } from "./convert-postscript-to-pdf";
import type { ConvertFailureMessage, ConvertSuccessMessage, MainToWorkerMessage } from "./messages";

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
