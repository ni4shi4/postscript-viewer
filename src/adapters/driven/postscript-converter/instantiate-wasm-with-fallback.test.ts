import { afterEach, describe, expect, it, vi } from "vitest";

import {
  instantiateWasmFromResponse,
  instantiateWasmWithStreamingFallback,
  tryInstantiateWasmStreaming,
} from "./instantiate-wasm-with-fallback";

const WASM_URL = "/gs.wasm";
const IMPORTS: WebAssembly.Imports = {};

const MINIMAL_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
const MINIMAL_WASM_BUFFER = MINIMAL_WASM.buffer;

function makeResponse(bytes: ArrayBuffer, contentType: string): Response {
  return new Response(bytes, {
    headers: { "Content-Type": contentType },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("tryInstantiateWasmStreaming", () => {
  it("returns undefined when instantiateStreaming is unavailable", async () => {
    vi.stubGlobal("WebAssembly", {
      instantiate: vi.fn(),
    });
    const response = makeResponse(MINIMAL_WASM_BUFFER, "application/wasm");
    const instance = await tryInstantiateWasmStreaming(response, IMPORTS);
    expect(instance).toBeUndefined();
  });

  it("returns an instance when streaming succeeds", async () => {
    const expectedInstance = { exports: {} } as WebAssembly.Instance;
    const instantiateStreaming = vi
      .fn()
      .mockResolvedValue({ instance: expectedInstance, module: {} as WebAssembly.Module });
    vi.stubGlobal("WebAssembly", { instantiateStreaming, instantiate: vi.fn() });

    const response = makeResponse(MINIMAL_WASM_BUFFER, "application/wasm");
    const instance = await tryInstantiateWasmStreaming(response, IMPORTS);

    expect(instance).toBe(expectedInstance);
    expect(instantiateStreaming).toHaveBeenCalledOnce();
  });

  it("returns undefined when streaming fails", async () => {
    const instantiateStreaming = vi
      .fn()
      .mockRejectedValue(new TypeError("Incorrect response MIME type"));
    vi.stubGlobal("WebAssembly", { instantiateStreaming, instantiate: vi.fn() });

    const response = makeResponse(MINIMAL_WASM_BUFFER, "application/octet-stream");
    const instance = await tryInstantiateWasmStreaming(response, IMPORTS);

    expect(instance).toBeUndefined();
  });
});

describe("instantiateWasmFromResponse", () => {
  it("uses arrayBuffer and WebAssembly.instantiate", async () => {
    const expectedInstance = { exports: {} } as WebAssembly.Instance;
    const instantiate = vi
      .fn()
      .mockResolvedValue({ instance: expectedInstance, module: {} as WebAssembly.Module });
    vi.stubGlobal("WebAssembly", { instantiate });

    const response = makeResponse(MINIMAL_WASM_BUFFER, "application/octet-stream");
    const instance = await instantiateWasmFromResponse(response, IMPORTS);

    expect(instance).toBe(expectedInstance);
    expect(instantiate).toHaveBeenCalledWith(MINIMAL_WASM_BUFFER, IMPORTS);
  });
});

describe("instantiateWasmWithStreamingFallback", () => {
  it("falls back to arrayBuffer instantiation when streaming fails", async () => {
    const expectedInstance = { exports: {} } as WebAssembly.Instance;
    const instantiateStreaming = vi
      .fn()
      .mockRejectedValue(new TypeError("Incorrect response MIME type"));
    const instantiate = vi
      .fn()
      .mockResolvedValue({ instance: expectedInstance, module: {} as WebAssembly.Module });
    vi.stubGlobal("WebAssembly", { instantiateStreaming, instantiate });

    const fetch = vi
      .fn()
      .mockResolvedValue(makeResponse(MINIMAL_WASM_BUFFER, "application/octet-stream"));
    vi.stubGlobal("fetch", fetch);

    const instance = await instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS);

    expect(fetch).toHaveBeenCalledWith(WASM_URL, { credentials: "same-origin" });
    expect(instantiateStreaming).toHaveBeenCalledOnce();
    expect(instantiate).toHaveBeenCalledWith(MINIMAL_WASM_BUFFER, IMPORTS);
    expect(instance).toBe(expectedInstance);
  });

  it("rejects when fetch returns a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" })),
    );

    await expect(instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS)).rejects.toThrow(
      /Failed to fetch WASM \(404\)/,
    );
  });

  it("uses streaming when it succeeds", async () => {
    const expectedInstance = { exports: {} } as WebAssembly.Instance;
    const instantiateStreaming = vi
      .fn()
      .mockResolvedValue({ instance: expectedInstance, module: {} as WebAssembly.Module });
    const instantiate = vi.fn();
    vi.stubGlobal("WebAssembly", { instantiateStreaming, instantiate });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse(MINIMAL_WASM_BUFFER, "application/wasm")),
    );

    const instance = await instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS);

    expect(instantiateStreaming).toHaveBeenCalledOnce();
    expect(instantiate).not.toHaveBeenCalled();
    expect(instance).toBe(expectedInstance);
  });
});
