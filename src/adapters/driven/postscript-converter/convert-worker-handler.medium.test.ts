import { describe, expect, it } from "vitest";

import type { ConvertFailureMessage, ConvertSuccessMessage } from "./messages";
import { createConvertMessageHandler } from "./convert-worker-handler";

const POSTSCRIPT = new Uint8Array([37, 33, 80, 83]);
const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);

type PostedMessage = ConvertSuccessMessage | ConvertFailureMessage;

function createHandlerTestBed(convert: (postScript: Uint8Array) => Promise<Uint8Array>) {
  const posted: PostedMessage[] = [];
  const handler = createConvertMessageHandler({
    convert,
    deliverMessage(message) {
      posted.push(message);
    },
  });
  return { handler, posted };
}

describe("createConvertMessageHandler", () => {
  it("posts a success message when convert resolves", async () => {
    const { handler, posted } = createHandlerTestBed(async () => SAMPLE_PDF);

    await handler({
      type: "convert",
      id: "job-1",
      postScript: POSTSCRIPT,
      fileName: "sample.ps",
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      type: "success",
      id: "job-1",
      pdf: SAMPLE_PDF,
    });
  });

  it("posts a failure message when convert rejects with Error", async () => {
    const { handler, posted } = createHandlerTestBed(async () => {
      throw new Error("conversion blew up");
    });

    await expect(
      handler({
        type: "convert",
        id: "job-2",
        postScript: POSTSCRIPT,
        fileName: "sample.ps",
      }),
    ).resolves.toBeUndefined();

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      type: "failure",
      id: "job-2",
      error: "conversion blew up",
    });
  });

  it("posts a failure message when convert throws a non-Error value", async () => {
    const { handler, posted } = createHandlerTestBed(async () => {
      throw "plain failure";
    });

    await handler({
      type: "convert",
      id: "job-3",
      postScript: POSTSCRIPT,
      fileName: "sample.ps",
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      type: "failure",
      id: "job-3",
      error: "plain failure",
    });
  });

  it("ignores messages that are not convert requests", async () => {
    const { handler, posted } = createHandlerTestBed(async () => SAMPLE_PDF);

    await handler({ type: "failure", id: "x", error: "nope" });
    await handler({ type: "convert", id: "y" });
    await handler(null);
    await handler("convert");

    expect(posted).toHaveLength(0);
  });
});
