import { describe, expect, it } from "vitest";

import { ConversionAbortedError } from "../../../core/domain/conversion-aborted";
import { ConversionTimeoutError } from "../../../core/domain/conversion-timeout";
import type { ConvertRequestMessage, WorkerToMainMessage } from "./messages";
import {
  createWorkerPostScriptConverter,
  defaultWorkerPostScriptConverterDeps,
} from "./worker-postscript-converter";

const POSTSCRIPT = new Uint8Array([37, 33, 80, 83]);
const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
const TIMEOUT_MS = 60_000;

type PendingTimeout = {
  callback: () => void;
  delayMs: number;
  cancelled: boolean;
};

function createManualTimeoutScheduler() {
  const pending: PendingTimeout[] = [];

  return {
    scheduleTimeout(callback: () => void, delayMs: number) {
      const entry: PendingTimeout = { callback, delayMs, cancelled: false };
      pending.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    fireTimeoutsAtLeast(delayMs: number) {
      for (const entry of pending) {
        if (!entry.cancelled && entry.delayMs <= delayMs) {
          entry.callback();
        }
      }
    },
    hasPendingTimeout() {
      return pending.some((entry) => !entry.cancelled);
    },
  };
}

class FakeWorker {
  private readonly messageListeners = new Set<(event: MessageEvent<WorkerToMainMessage>) => void>();
  private readonly errorListeners = new Set<() => void>();
  lastRequest: ConvertRequestMessage | undefined;
  terminated = false;

  addEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent<WorkerToMainMessage>) => void) | (() => void),
  ): void {
    if (type === "message") {
      this.messageListeners.add(listener as (event: MessageEvent<WorkerToMainMessage>) => void);
      return;
    }
    this.errorListeners.add(listener as () => void);
  }

  removeEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent<WorkerToMainMessage>) => void) | (() => void),
  ): void {
    if (type === "message") {
      this.messageListeners.delete(listener as (event: MessageEvent<WorkerToMainMessage>) => void);
      return;
    }
    this.errorListeners.delete(listener as () => void);
  }

  postMessage(data: ConvertRequestMessage): void {
    this.lastRequest = data;
  }

  terminate(): void {
    this.terminated = true;
    for (const listener of this.errorListeners) {
      listener();
    }
  }

  deliverSuccess(pdf: Uint8Array): void {
    const id = this.lastRequest?.id ?? "";
    const event = { data: { type: "success", id, pdf } } as MessageEvent<WorkerToMainMessage>;
    for (const listener of this.messageListeners) {
      listener(event);
    }
  }
}

function createTestConverter(
  fakeWorker: FakeWorker,
  timeoutScheduler: ReturnType<typeof createManualTimeoutScheduler>,
) {
  return createWorkerPostScriptConverter({
    ...defaultWorkerPostScriptConverterDeps(),
    createWorker: () => fakeWorker as unknown as Worker,
    conversionTimeoutMs: TIMEOUT_MS,
    scheduleTimeout: timeoutScheduler.scheduleTimeout,
  });
}

describe("createWorkerPostScriptConverter", () => {
  it("resolves when the worker posts a success message before the timeout", async () => {
    const fakeWorker = new FakeWorker();
    const timeoutScheduler = createManualTimeoutScheduler();
    const converter = createTestConverter(fakeWorker, timeoutScheduler);
    const progress: string[] = [];

    const convertPromise = converter.convert(POSTSCRIPT, {
      fileName: "sample.ps",
      signal: new AbortController().signal,
      onProgress: (event) => {
        progress.push(event.kind);
      },
    });

    fakeWorker.deliverSuccess(SAMPLE_PDF);

    const pdf = await convertPromise;

    expect(pdf).toEqual(SAMPLE_PDF);
    expect(progress).toEqual(["started", "completed"]);
    expect(fakeWorker.terminated).toBe(true);
    expect(timeoutScheduler.hasPendingTimeout()).toBe(false);
  });

  it("rejects with ConversionTimeoutError when the worker does not respond in time", async () => {
    const fakeWorker = new FakeWorker();
    const timeoutScheduler = createManualTimeoutScheduler();
    const converter = createTestConverter(fakeWorker, timeoutScheduler);

    const convertPromise = converter.convert(POSTSCRIPT, {
      fileName: "sample.ps",
      signal: new AbortController().signal,
      onProgress: () => {},
    });

    timeoutScheduler.fireTimeoutsAtLeast(TIMEOUT_MS);

    await expect(convertPromise).rejects.toBeInstanceOf(ConversionTimeoutError);
    expect(fakeWorker.terminated).toBe(true);
  });

  it("rejects with ConversionAbortedError when the user aborts before the timeout", async () => {
    const fakeWorker = new FakeWorker();
    const timeoutScheduler = createManualTimeoutScheduler();
    const converter = createTestConverter(fakeWorker, timeoutScheduler);
    const abortController = new AbortController();

    const convertPromise = converter.convert(POSTSCRIPT, {
      fileName: "sample.ps",
      signal: abortController.signal,
      onProgress: () => {},
    });

    abortController.abort();

    await expect(convertPromise).rejects.toBeInstanceOf(ConversionAbortedError);
    expect(fakeWorker.terminated).toBe(true);
    timeoutScheduler.fireTimeoutsAtLeast(TIMEOUT_MS);
    expect(timeoutScheduler.hasPendingTimeout()).toBe(false);
  });
});
