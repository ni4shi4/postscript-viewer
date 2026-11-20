const FETCH_CREDENTIALS: RequestCredentials = "same-origin";

function assertWasmFetchSucceeded(response: Response, wasmUrl: string): void {
  if (response.ok) {
    return;
  }
  throw new Error(`Failed to fetch WASM (${String(response.status)}): ${wasmUrl}`);
}

export async function instantiateWasmWithStreamingFallback(
  wasmUrl: string,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  const response = await fetch(wasmUrl, { credentials: FETCH_CREDENTIALS });
  assertWasmFetchSucceeded(response, wasmUrl);
  const streamingInstance = await tryInstantiateWasmStreaming(response, imports);
  if (streamingInstance !== undefined) {
    return streamingInstance;
  }
  return instantiateWasmFromResponse(response, imports);
}

export async function tryInstantiateWasmStreaming(
  response: Response,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance | undefined> {
  if (typeof WebAssembly.instantiateStreaming !== "function") {
    return undefined;
  }
  try {
    const result = await WebAssembly.instantiateStreaming(response.clone(), imports);
    return result.instance;
  } catch {
    return undefined;
  }
}

export async function instantiateWasmFromResponse(
  response: Response,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  const wasmBytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(wasmBytes, imports);
  return result.instance;
}
