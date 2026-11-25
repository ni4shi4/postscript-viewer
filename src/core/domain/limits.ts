const MEBIBYTE = 1024 * 1024;
const SECOND_MS = 1000;

export const MAX_POSTSCRIPT_INPUT_BYTES = 32 * MEBIBYTE;
export const MAX_DECOMPRESSED_POSTSCRIPT_BYTES = 32 * MEBIBYTE;
export const MAX_CONVERSION_DURATION_MS = 60 * SECOND_MS;
export const MAX_PDF_HISTORY_ENTRIES = 10;

export type ByteLimitKind = "input" | "decompressed";

export class TooLargeError extends Error {
  override readonly name = "TooLargeError";
  readonly limit: ByteLimitKind;

  constructor(limit: ByteLimitKind) {
    super(`PostScript exceeds ${limit} byte limit`);
    this.limit = limit;
  }
}

export function byteLimitInMebibytes(kind: ByteLimitKind): number {
  const bytes = kind === "input" ? MAX_POSTSCRIPT_INPUT_BYTES : MAX_DECOMPRESSED_POSTSCRIPT_BYTES;
  return bytes / MEBIBYTE;
}

export function formattedByteLimit(kind: ByteLimitKind): string {
  return `${byteLimitInMebibytes(kind)} MiB`;
}

export function conversionTimeLimitInSeconds(): number {
  return MAX_CONVERSION_DURATION_MS / SECOND_MS;
}

export function assertWithinByteLimit(size: number, limit: ByteLimitKind): void {
  const maxBytes =
    limit === "input" ? MAX_POSTSCRIPT_INPUT_BYTES : MAX_DECOMPRESSED_POSTSCRIPT_BYTES;
  if (size > maxBytes) {
    throw new TooLargeError(limit);
  }
}
