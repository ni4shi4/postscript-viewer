export type ConvertRequestMessage = {
  type: "convert";
  id: string;
  postScript: Uint8Array;
  fileName: string;
};

export type ConvertSuccessMessage = {
  type: "success";
  id: string;
  pdf: Uint8Array;
};

export type ConvertFailureMessage = {
  type: "failure";
  id: string;
  error: string;
};

export type MainToWorkerMessage = ConvertRequestMessage;

export type WorkerToMainMessage = ConvertSuccessMessage | ConvertFailureMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isConvertRequestMessage(value: unknown): value is ConvertRequestMessage {
  if (!isRecord(value) || value.type !== "convert") {
    return false;
  }
  return (
    typeof value.id === "string" &&
    value.postScript instanceof Uint8Array &&
    typeof value.fileName === "string"
  );
}

export function isConvertSuccessMessage(value: unknown): value is ConvertSuccessMessage {
  if (!isRecord(value) || value.type !== "success") {
    return false;
  }
  return typeof value.id === "string" && value.pdf instanceof Uint8Array;
}

export function isConvertFailureMessage(value: unknown): value is ConvertFailureMessage {
  if (!isRecord(value) || value.type !== "failure") {
    return false;
  }
  return typeof value.id === "string" && typeof value.error === "string";
}

export function isWorkerToMainMessage(value: unknown): value is WorkerToMainMessage {
  return isConvertSuccessMessage(value) || isConvertFailureMessage(value);
}
