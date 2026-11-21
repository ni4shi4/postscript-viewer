import type { ConvertFailureMessage, ConvertSuccessMessage } from "./messages";
import { isConvertRequestMessage } from "./messages";

export type ConvertMessageHandlerDeps = {
  convert: (postScript: Uint8Array) => Promise<Uint8Array>;
  deliverMessage: (
    message: ConvertSuccessMessage | ConvertFailureMessage,
    transfer?: Transferable[],
  ) => void;
};

export function createConvertMessageHandler(
  deps: ConvertMessageHandlerDeps,
): (data: unknown) => Promise<void> {
  return async function handleConvertMessage(data: unknown): Promise<void> {
    if (!isConvertRequestMessage(data)) {
      return;
    }

    try {
      const pdf = await deps.convert(data.postScript);
      const message: ConvertSuccessMessage = { type: "success", id: data.id, pdf };
      deps.deliverMessage(message, [pdf.buffer]);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const message: ConvertFailureMessage = { type: "failure", id: data.id, error };
      deps.deliverMessage(message);
    }
  };
}
