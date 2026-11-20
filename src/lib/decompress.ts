import { ungzip } from "pako";

const GZIP_MAGIC_BYTE_0 = 0x1f;
const GZIP_MAGIC_BYTE_1 = 0x8b;

export function isGzipFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".gz");
}

export function hasGzipMagic(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === GZIP_MAGIC_BYTE_0 && data[1] === GZIP_MAGIC_BYTE_1;
}

export function decompressGzip(compressed: Uint8Array): Uint8Array {
  if (!hasGzipMagic(compressed)) {
    throw new Error("File is not in gzip format");
  }
  return ungzip(compressed);
}
