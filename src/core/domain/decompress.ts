import { Inflate } from "pako";

import { MAX_DECOMPRESSED_POSTSCRIPT_BYTES, TooLargeError } from "./limits";

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

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const chunk of chunks) {
    length += chunk.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function throwIfDecompressedChunkExceedsLimit(totalSize: number, chunkLength: number): void {
  if (totalSize + chunkLength > MAX_DECOMPRESSED_POSTSCRIPT_BYTES) {
    throw new TooLargeError("decompressed");
  }
}

export function decompressGzip(compressed: Uint8Array): Uint8Array {
  if (!hasGzipMagic(compressed)) {
    throw new NotGzipError();
  }

  const chunks: Uint8Array[] = [];
  let decompressedSize = 0;
  const inflater = new Inflate();

  inflater.onData = (chunk: Uint8Array) => {
    throwIfDecompressedChunkExceedsLimit(decompressedSize, chunk.length);
    decompressedSize += chunk.length;
    chunks.push(chunk);
  };

  const finished = inflater.push(compressed, true);
  if (!finished && inflater.err !== 0) {
    throw new Error(inflater.msg);
  }

  return concatChunks(chunks);
}
