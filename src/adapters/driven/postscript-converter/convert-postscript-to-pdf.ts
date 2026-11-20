import { GS_PDFWRITE_ARGS } from "./ghostscript-args";
import { getGhostscriptModule } from "./load-ghostscript-module";
import type { GhostscriptModule } from "./load-ghostscript-module";

const GS_INPUT_PS = "input.ps" as const;
const GS_OUTPUT_PDF = "output.pdf" as const;

const PDF_MAGIC = "%PDF-" as const;

function buildGhostscriptCliArgs(): string[] {
  return [...GS_PDFWRITE_ARGS, `-sOutputFile=${GS_OUTPUT_PDF}`, GS_INPUT_PS];
}

function removeGhostscriptVirtualFiles(gs: GhostscriptModule): void {
  try {
    gs.FS.unlink(GS_INPUT_PS);
  } catch {
    // input may be absent after a failed run
  }
  try {
    gs.FS.unlink(GS_OUTPUT_PDF);
  } catch {
    // output may be absent after a failed run
  }
}

function assertPdfBytes(pdf: Uint8Array): void {
  const header = new TextDecoder().decode(pdf.subarray(0, PDF_MAGIC.length));
  if (!header.startsWith(PDF_MAGIC)) {
    throw new Error("Ghostscript output is not a PDF");
  }
}

export function convertPostScriptToPdfWithModule(
  gs: GhostscriptModule,
  postScript: Uint8Array,
): Uint8Array {
  gs.FS.writeFile(GS_INPUT_PS, postScript);
  const exitCode = gs.callMain(buildGhostscriptCliArgs());
  try {
    if (exitCode !== 0) {
      throw new Error(`Ghostscript exited with status ${String(exitCode)}`);
    }
    const pdf = gs.FS.readFile(GS_OUTPUT_PDF, { encoding: "binary" });
    assertPdfBytes(pdf);
    return pdf;
  } finally {
    removeGhostscriptVirtualFiles(gs);
  }
}

export async function convertPostScriptToPdf(postScript: Uint8Array): Promise<Uint8Array> {
  const gs = await getGhostscriptModule();
  return convertPostScriptToPdfWithModule(gs, postScript);
}
