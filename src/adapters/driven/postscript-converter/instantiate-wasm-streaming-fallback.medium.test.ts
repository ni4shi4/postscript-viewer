import { afterEach, describe, expect, it, vi } from "vitest";

import { instantiateWasmWithStreamingFallback } from "./instantiate-wasm-with-fallback";

const WASM_URL = "/test.wasm";
const IMPORTS: WebAssembly.Imports = {};

const MINIMAL_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

const realWebAssembly = globalThis.WebAssembly;
const RealWasmInstance = realWebAssembly.Instance;

function stubFetch(contentType: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(MINIMAL_WASM, {
        headers: { "Content-Type": contentType },
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("instantiateWasmWithStreamingFallback (behavior)", () => {
  it("returns a WebAssembly instance when the response MIME is application/wasm", async () => {
    stubFetch("application/wasm");

    const instance = await instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS);

    expect(instance).toBeInstanceOf(RealWasmInstance);
  });

  it("returns a WebAssembly instance when the MIME is not application/wasm", async () => {
    stubFetch("application/octet-stream");

    const instance = await instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS);

    expect(instance).toBeInstanceOf(RealWasmInstance);
  });

  it("returns a WebAssembly instance when instantiateStreaming is unavailable", async () => {
    stubFetch("application/wasm");
    vi.stubGlobal("WebAssembly", {
      instantiate: realWebAssembly.instantiate.bind(realWebAssembly),
    });

    const instance = await instantiateWasmWithStreamingFallback(WASM_URL, IMPORTS);

    expect(instance).toBeInstanceOf(RealWasmInstance);
  });
});
