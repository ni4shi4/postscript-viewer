let fallbackSequence = 0;

function createRequestIdWithoutRandomUuid(): string {
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  fallbackSequence += 1;
  const hex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `req-${hex}-${fallbackSequence}`;
}

export function createRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createRequestIdWithoutRandomUuid();
}
