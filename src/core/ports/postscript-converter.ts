export type ConversionProgress = { kind: "started" } | { kind: "completed" };

export type PostScriptConverter = {
  convert(
    postScript: Uint8Array,
    options: {
      fileName: string;
      onProgress: (progress: ConversionProgress) => void;
      signal: AbortSignal;
    },
  ): Promise<Uint8Array>;
};
