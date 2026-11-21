import { convertPostScriptToPdf } from "./convert-postscript-to-pdf";
import { createConvertMessageHandler } from "./convert-worker-handler";

const handleConvertMessage = createConvertMessageHandler({
  convert: convertPostScriptToPdf,
  deliverMessage(message, transfer) {
    if (transfer === undefined) {
      self.postMessage(message);
      return;
    }
    self.postMessage(message, transfer);
  },
});

self.addEventListener("message", (event) => {
  void handleConvertMessage(event.data);
});
