import { ConversionAbortedError } from "../../../core/domain/conversion-aborted";
import { ConversionTimeoutError } from "../../../core/domain/conversion-timeout";
import { MAX_CONVERSION_DURATION_MS } from "../../../core/domain/limits";
import type { PostScriptConverter } from "../../../core/ports/postscript-converter";
import { createRequestId } from "./create-request-id";
import type { WorkerToMainMessage } from "./messages";

function createConvertWorker(): Worker {
  return new Worker(new URL("./convert.worker.ts", import.meta.url), {
    type: "module",
  });
}

type ConversionWaitDeps = {
  conversionTimeoutMs: number;
  scheduleTimeout: (callback: () => void, delayMs: number) => () => void;
};

function rejectUnlessAborted(
  aborted: () => boolean,
  reject: (error: Error) => void,
  whenNotAborted: () => void,
): void {
  if (aborted()) {
    reject(new ConversionAbortedError());
    return;
  }
  whenNotAborted();
}

function waitForConversion(
  worker: Worker,
  requestId: string,
  aborted: () => boolean,
  waitDeps: ConversionWaitDeps,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (handler: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      clearConversionTimeout();
      handler();
    };

    const clearConversionTimeout = waitDeps.scheduleTimeout(() => {
      settle(() => {
        worker.terminate();
      });
      rejectUnlessAborted(aborted, reject, () => {
        reject(new ConversionTimeoutError());
      });
    }, waitDeps.conversionTimeoutMs);

    const onMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data;
      if (message.id !== requestId) {
        return;
      }
      settle(() => {
        worker.terminate();
      });
      rejectUnlessAborted(aborted, reject, () => {
        if (message.type === "success") {
          resolve(message.pdf);
          return;
        }
        reject(new Error(message.error));
      });
    };

    const onWorkerError = (): void => {
      settle(() => {
        worker.terminate();
      });
      rejectUnlessAborted(aborted, reject, () => {
        reject(new Error("Conversion worker failed"));
      });
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onWorkerError);
  });
}

export type WorkerPostScriptConverterDeps = {
  createWorker: () => Worker;
  conversionTimeoutMs: number;
  scheduleTimeout: (callback: () => void, delayMs: number) => () => void;
};

export function defaultWorkerPostScriptConverterDeps(): WorkerPostScriptConverterDeps {
  return {
    createWorker: createConvertWorker,
    conversionTimeoutMs: MAX_CONVERSION_DURATION_MS,
    scheduleTimeout: (callback, delayMs) => {
      const handle = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(handle);
      };
    },
  };
}

export function createWorkerPostScriptConverter(
  deps: WorkerPostScriptConverterDeps = defaultWorkerPostScriptConverterDeps(),
): PostScriptConverter {
  const waitDeps: ConversionWaitDeps = {
    conversionTimeoutMs: deps.conversionTimeoutMs,
    scheduleTimeout: deps.scheduleTimeout,
  };

  return {
    async convert(postScript, options) {
      if (options.signal.aborted) {
        throw new ConversionAbortedError();
      }

      const requestId = createRequestId();
      const worker = deps.createWorker();
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
          waitDeps,
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
