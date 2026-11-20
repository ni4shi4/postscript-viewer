const UUID_BYTE_LENGTH = 16;

const UUID_VERSION_NIBBLE_MASK = 0x0f;
const UUID_VERSION_4 = 0x40;

const UUID_VARIANT_NIBBLE_MASK = 0x3f;
const UUID_VARIANT_RFC4122 = 0x80;

const UUID_VERSION_BYTE_INDEX = 6;
const UUID_VARIANT_BYTE_INDEX = 8;

function applyUuidVersionNibble(byte: number): number {
  return (byte & UUID_VERSION_NIBBLE_MASK) | UUID_VERSION_4;
}

function applyUuidVariantNibble(byte: number): number {
  return (byte & UUID_VARIANT_NIBBLE_MASK) | UUID_VARIANT_RFC4122;
}

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function formatUuidV4(bytes: Uint8Array): string {
  const hex = Array.from(bytes, byteToHex);
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createRequestId(): string {
  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  bytes[UUID_VERSION_BYTE_INDEX] = applyUuidVersionNibble(bytes[UUID_VERSION_BYTE_INDEX]);
  bytes[UUID_VARIANT_BYTE_INDEX] = applyUuidVariantNibble(bytes[UUID_VARIANT_BYTE_INDEX]);
  return formatUuidV4(bytes);
}
