import { decompressGzip, isGzipFileName } from "./lib/decompress";
import type { WorkerToMainMessage } from "./worker/messages";

const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const viewerFrame = document.querySelector<HTMLIFrameElement>("iframe");

if (fileInput === null || viewerFrame === null) {
  throw new Error("Required page elements are missing");
}

const filePicker = fileInput;
const pdfFrame = viewerFrame;

let activePdfObjectUrl: string | undefined;

function revokeActivePdfObjectUrl(): void {
  if (activePdfObjectUrl === undefined) {
    return;
  }
  URL.revokeObjectURL(activePdfObjectUrl);
  activePdfObjectUrl = undefined;
}

function showPdfInFrame(pdf: Uint8Array): void {
  revokeActivePdfObjectUrl();
  const blob = new Blob([Uint8Array.from(pdf)], {
    type: "application/pdf",
  });
  activePdfObjectUrl = URL.createObjectURL(blob);
  pdfFrame.src = activePdfObjectUrl;
}

async function readPostScriptBytes(file: File): Promise<Uint8Array> {
  const raw = new Uint8Array(await file.arrayBuffer());
  if (isGzipFileName(file.name)) {
    return decompressGzip(raw);
  }
  return raw;
}

function createConvertWorker(): Worker {
  return new Worker(new URL("./worker/convert.worker.ts", import.meta.url), {
    type: "module",
  });
}

function waitForConversion(
  worker: Worker,
  requestId: string,
): Promise<Uint8Array> {
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

async function convertAndDisplay(file: File): Promise<void> {
  const postScript = await readPostScriptBytes(file);
  const requestId = crypto.randomUUID();
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

  const pdf = await waitForConversion(worker, requestId);
  showPdfInFrame(pdf);
}

filePicker.addEventListener("change", () => {
  const file = filePicker.files?.[0];
  if (!file) {
    return;
  }
  void convertAndDisplay(file).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
  });
});