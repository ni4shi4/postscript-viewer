import { ungzip } from "pako";

export function isGzipFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".gz");
}

export function decompressGzip(compressed: Uint8Array): Uint8Array {
  return ungzip(compressed);
}