import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { convertPostScriptToPdfWithModule } from "./convert-postscript-to-pdf";
import { loadGhostscriptModule, type GhostscriptModuleOverrides } from "./load-ghostscript-module";

const PDF_MAGIC = "%PDF-";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const gsWasmPath = path.join(projectRoot, "public/gs.wasm");
const gsGluePath = path.join(projectRoot, "src/generated/ghostscript/gs.mjs");
const minimalPsPath = path.join(projectRoot, "e2e/fixtures/minimal.ps");

function assertGhostscriptArtifactsPresent(): void {
  if (!existsSync(gsWasmPath) || !existsSync(gsGluePath)) {
    throw new Error(
      "Ghostscript WASM 成果物がありません。先に npm run build:wasm または npm run fetch:wasm を実行してください。",
    );
  }
}

function createNodeInstantiateWasm(
  wasmPath: string,
): NonNullable<GhostscriptModuleOverrides["instantiateWasm"]> {
  return (imports, receiveInstance) => {
    const wasmBytes = readFileSync(wasmPath);
    void WebAssembly.instantiate(wasmBytes, imports).then(({ instance }) => {
      receiveInstance(instance);
    });
    return {};
  };
}

function pdfHeader(pdf: Uint8Array): string {
  return new TextDecoder().decode(pdf.subarray(0, PDF_MAGIC.length));
}

assertGhostscriptArtifactsPresent();

const minimalPostScript = readFileSync(minimalPsPath);

describe("convertPostScriptToPdfWithModule (real Ghostscript WASM)", () => {
  it("returns PDF bytes that start with %PDF- for minimal PostScript", async () => {
    const gs = await loadGhostscriptModule({
      instantiateWasm: createNodeInstantiateWasm(gsWasmPath),
    });

    const pdf = convertPostScriptToPdfWithModule(gs, minimalPostScript);

    expect(pdfHeader(pdf)).toBe(PDF_MAGIC);
  }, 120_000);

  it("throws when PostScript input is invalid", async () => {
    const gs = await loadGhostscriptModule({
      instantiateWasm: createNodeInstantiateWasm(gsWasmPath),
    });
    const invalidInput = new TextEncoder().encode("not valid PostScript");

    expect(() => convertPostScriptToPdfWithModule(gs, invalidInput)).toThrow();
  }, 120_000);
});
