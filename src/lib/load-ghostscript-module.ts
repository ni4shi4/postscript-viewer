import createModule from "ghostscript-wasm-esm";

import { GS_WASM_PATH } from "./gs-wasm-path";

export type GhostscriptFs = {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string, options: { encoding: "binary" }): Uint8Array;
  unlink(path: string): void;
};

export type GhostscriptModule = {
  callMain(args: string[]): number;
  FS: GhostscriptFs;
};

export type GhostscriptModuleOverrides = {
  locateFile?: (file: string, scriptDirectory: string) => string;
};

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
  const module = await createModule({
    ...moduleOverrides,
    locateFile: moduleOverrides?.locateFile ?? gsWasmLocateFile,
  });
  return module as GhostscriptModule;
}

let cachedModule: Promise<GhostscriptModule> | undefined;

export function getGhostscriptModule(): Promise<GhostscriptModule> {
  if (cachedModule === undefined) {
    cachedModule = loadGhostscriptModule();
  }
  return cachedModule;
}
