import type { GhostscriptFs, GhostscriptModule } from "./load-ghostscript-module";

export type FakeGhostscriptScenario =
  | { kind: "success"; pdfBytes: Uint8Array }
  | { kind: "non-zero-exit"; exitCode: number }
  | { kind: "invalid-pdf-output"; outputBytes: Uint8Array };

export type FakeGhostscriptModule = {
  module: GhostscriptModule;
  listVirtualFilePaths: () => string[];
};

function createMemoryGhostscriptFs(): {
  fs: GhostscriptFs;
  listPaths: () => string[];
} {
  const files = new Map<string, Uint8Array>();

  const fs: GhostscriptFs = {
    writeFile(path, data) {
      files.set(path, data);
    },
    readFile(path, _options) {
      const data = files.get(path);
      if (data === undefined) {
        throw new Error(`no such file or directory, open '${path}'`);
      }
      return data;
    },
    unlink(path) {
      files.delete(path);
    },
  };

  return {
    fs,
    listPaths: () => [...files.keys()],
  };
}

export function createFakeGhostscriptModule(
  scenario: FakeGhostscriptScenario,
): FakeGhostscriptModule {
  const { fs, listPaths } = createMemoryGhostscriptFs();

  const module: GhostscriptModule = {
    FS: fs,
    callMain(_args) {
      switch (scenario.kind) {
        case "success":
          fs.writeFile("output.pdf", scenario.pdfBytes);
          return 0;
        case "non-zero-exit":
          return scenario.exitCode;
        case "invalid-pdf-output":
          fs.writeFile("output.pdf", scenario.outputBytes);
          return 0;
        default: {
          const unreachable: never = scenario;
          return unreachable;
        }
      }
    },
  };

  return { module, listVirtualFilePaths: listPaths };
}
