import { ConversionAbortedError } from "../../../core/domain/conversion-aborted";
import type { PostScriptConverter } from "../../../core/ports/postscript-converter";
import { createRequestId } from "./create-request-id";
import type { WorkerToMainMessage } from "./messages";

function createConvertWorker(): Worker {
  return new Worker(new URL("./convert.worker.ts", import.meta.url), {
    type: "module",
  });
}

function waitForConversion(
  worker: Worker,
  requestId: string,
  aborted: () => boolean,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const finalize = (handler: () => void): void => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      handler();
    };

    const onMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data;
      if (message.id !== requestId) {
        return;
      }
      finalize(() => {
        worker.terminate();
      });
      if (aborted()) {
        reject(new ConversionAbortedError());
        return;
      }
      if (message.type === "success") {
        resolve(message.pdf);
        return;
      }
      reject(new Error(message.error));
    };

    const onWorkerError = (): void => {
      finalize(() => {
        worker.terminate();
      });
      if (aborted()) {
        reject(new ConversionAbortedError());
        return;
      }
      reject(new Error("Conversion worker failed"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onWorkerError);
  });
}

export function createWorkerPostScriptConverter(): PostScriptConverter {
  return {
    async convert(postScript, options) {
      if (options.signal.aborted) {
        throw new ConversionAbortedError();
      }

      const requestId = createRequestId();
      const worker = createConvertWorker();
      let conversionAborted = false;

      const onAbort = (): void => {
        conversionAborted = true;
        worker.terminate();
      };

      options.signal.addEventListener("abort", onAbort, { once: true });

      options.onProgress({ kind: "started" });

      worker.postMessage(
        {
          type: "convert",
          id: requestId,
          postScript,
          fileName: options.fileName,
        },
        [postScript.buffer],
      );

      try {
        const pdf = await waitForConversion(
          worker,
          requestId,
          () => conversionAborted || options.signal.aborted,
        );
        options.onProgress({ kind: "completed" });
        return pdf;
      } catch (err) {
        if (conversionAborted || options.signal.aborted) {
          throw new ConversionAbortedError();
        }
        throw err;
      } finally {
        options.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
