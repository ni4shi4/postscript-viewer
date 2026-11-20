import "./app.css";

import { createRequestId } from "./adapters/driven/postscript-converter/create-request-id";
import { NotGzipError, decompressGzip, isGzipFileName } from "./core/domain/decompress";
import type { WorkerToMainMessage } from "./adapters/driven/postscript-converter/messages";
import {
  presentConversionError,
  presentConverting,
  presentPdfInFrame,
  queryViewerDom,
  resetFileInputSelection,
} from "./adapters/driving/dom/viewer-ui";

const viewerDom = queryViewerDom();
const filePicker = viewerDom.fileInput;

let activePdfObjectUrl: string | undefined;

function revokeActivePdfObjectUrl(): void {
  if (activePdfObjectUrl === undefined) {
    return;
  }
  URL.revokeObjectURL(activePdfObjectUrl);
  activePdfObjectUrl = undefined;
}

function createPdfObjectUrl(pdf: Uint8Array): string {
  const blob = new Blob([Uint8Array.from(pdf)], {
    type: "application/pdf",
  });
  return URL.createObjectURL(blob);
}

function showPdfInFrame(pdf: Uint8Array): void {
  revokeActivePdfObjectUrl();
  activePdfObjectUrl = createPdfObjectUrl(pdf);
  presentPdfInFrame(viewerDom, activePdfObjectUrl);
}

async function readPostScriptBytes(file: File): Promise<Uint8Array> {
  const raw = new Uint8Array(await file.arrayBuffer());
  if (isGzipFileName(file.name)) {
    return decompressGzip(raw);
  }
  return raw;
}

function createConvertWorker(): Worker {
  return new Worker(
    new URL("./adapters/driven/postscript-converter/convert.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

function waitForConversion(worker: Worker, requestId: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data;
      if (message.id !== requestId) {
        return;
      }
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      worker.terminate();
      if (message.type === "success") {
        resolve(message.pdf);
        return;
      }
      reject(new Error(message.error));
    };

    const onWorkerError = (): void => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      worker.terminate();
      reject(new Error("Conversion worker failed"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onWorkerError);
  });
}

async function convertFileToPdf(file: File): Promise<Uint8Array> {
  const postScript = await readPostScriptBytes(file);
  const requestId = createRequestId();
  const worker = createConvertWorker();

  worker.postMessage(
    {
      type: "convert",
      id: requestId,
      postScript,
      fileName: file.name,
    },
    [postScript.buffer],
  );

  return waitForConversion(worker, requestId);
}

function userMessageForNotGzipError(): string {
  return "gzip 形式ではありません。.gz ファイルは gzip 圧縮された PostScript を選んでください";
}

function userMessageFromError(err: Error): string {
  return err.message;
}

function messageFromUnknownError(err: unknown): string {
  if (err instanceof NotGzipError) {
    return userMessageForNotGzipError();
  }
  if (err instanceof Error) {
    return userMessageFromError(err);
  }
  return String(err);
}

async function convertAndDisplay(file: File): Promise<void> {
  revokeActivePdfObjectUrl();
  presentConverting(viewerDom);

  try {
    const pdf = await convertFileToPdf(file);
    showPdfInFrame(pdf);
  } catch (err: unknown) {
    revokeActivePdfObjectUrl();
    const message = messageFromUnknownError(err);
    presentConversionError(viewerDom, message);
    console.error(message);
  }
}

filePicker.addEventListener("change", () => {
  const file = filePicker.files?.[0];
  if (!file) {
    return;
  }
  void convertAndDisplay(file).finally(() => {
    resetFileInputSelection(filePicker);
  });
});
