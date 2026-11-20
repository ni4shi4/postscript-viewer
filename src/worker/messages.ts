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
