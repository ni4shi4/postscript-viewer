import { ungzip } from "pako";

const GZIP_MAGIC_BYTE_0 = 0x1f;
const GZIP_MAGIC_BYTE_1 = 0x8b;

export class NotGzipError extends Error {
  override readonly name = "NotGzipError";
}

export function isGzipFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".gz");
}

function hasGzipMagic(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === GZIP_MAGIC_BYTE_0 && data[1] === GZIP_MAGIC_BYTE_1;
}

export function decompressGzip(compressed: Uint8Array): Uint8Array {
  if (!hasGzipMagic(compressed)) {
    throw new NotGzipError();
  }
  return ungzip(compressed);
}
