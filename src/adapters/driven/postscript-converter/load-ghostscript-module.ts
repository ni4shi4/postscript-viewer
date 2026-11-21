import { GS_WASM_PATH } from "./gs-wasm-path";
import { instantiateWasmWithStreamingFallback } from "./instantiate-wasm-with-fallback";

export type GhostscriptFs = {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string, options: { encoding: "binary" }): Uint8Array;
  unlink(path: string): void;
};

export type GhostscriptModule = {
  callMain(args: string[]): number;
  FS: GhostscriptFs;
};

type InstantiateWasmHook = (
  imports: WebAssembly.Imports,
  receiveInstance: (instance: WebAssembly.Instance) => void,
) => WebAssembly.Exports | Record<string, never> | false;

export type GhostscriptModuleOverrides = {
  locateFile?: (file: string, scriptDirectory: string) => string;
  instantiateWasm?: InstantiateWasmHook;
};

const GS_WASM_FILE = "gs.wasm" as const;

function createInstantiateWasmHook(
  locateFile: (file: string, scriptDirectory: string) => string,
  onWasmLoadFailed: (error: unknown) => void,
): InstantiateWasmHook {
  return (
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance) => void,
  ) => {
    const wasmUrl = locateFile(GS_WASM_FILE, "");
    void instantiateWasmWithStreamingFallback(wasmUrl, imports).then(
      receiveInstance,
      onWasmLoadFailed,
    );
    return {};
  };
}

export function gsWasmLocateFile(file: string, _scriptDirectory: string): string {
  if (file.endsWith(".wasm")) {
    return GS_WASM_PATH;
  }
  return file;
}

/**
 * Loads and initializes the Ghostscript Emscripten module (fetches `gs.wasm` via `locateFile`).
 * WASM instantiation details live here so W4 can add a streaming fallback in one place.
 */
export async function loadGhostscriptModule(
  moduleOverrides?: GhostscriptModuleOverrides,
): Promise<GhostscriptModule> {
  const locateFile = moduleOverrides?.locateFile ?? gsWasmLocateFile;

  let rejectWasmLoad!: (error: unknown) => void;
  const wasmLoadFailed = new Promise<never>((_, reject) => {
    rejectWasmLoad = reject;
  });

  const instantiateWasm =
    moduleOverrides?.instantiateWasm ?? createInstantiateWasmHook(locateFile, rejectWasmLoad);

  const { default: createModule } = await import("../../../generated/ghostscript/gs");

  const module = await Promise.race([
    createModule({
      ...moduleOverrides,
      locateFile,
      instantiateWasm,
    }),
    wasmLoadFailed,
  ]);
  return module as GhostscriptModule;
}

let cachedModule: Promise<GhostscriptModule> | undefined;

export function getGhostscriptModule(): Promise<GhostscriptModule> {
  if (cachedModule === undefined) {
    cachedModule = loadGhostscriptModule();
  }
  return cachedModule;
}
