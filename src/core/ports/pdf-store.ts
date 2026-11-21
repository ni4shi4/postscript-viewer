export type PdfStoreEntry = {
  fileName: string;
  pdf: Uint8Array;
};

export type PdfStore = {
  save(entry: PdfStoreEntry): Promise<void>;
  load(): Promise<PdfStoreEntry | undefined>;
  clear(): Promise<void>;
};
