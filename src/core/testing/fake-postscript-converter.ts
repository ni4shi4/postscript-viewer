import type { PostScriptConverter } from "../ports/postscript-converter";

export type RecordedConversion = {
  postScript: Uint8Array;
  fileName: string;
  signal: AbortSignal;
};

type ConversionSettlement = {
  settled: boolean;
  resolve: (pdf: Uint8Array) => void;
  reject: (error: Error) => void;
};

export type FakePostScriptConverter = PostScriptConverter & {
  getConversions(): readonly RecordedConversion[];
  completeAt(index: number, pdf: Uint8Array): void;
  failAt(index: number, error: Error): void;
};

export function createFakePostScriptConverter(): FakePostScriptConverter {
  const conversions: RecordedConversion[] = [];
  const settlements: ConversionSettlement[] = [];

  const requireUnsettled = (index: number): ConversionSettlement => {
    const settlement = settlements[index];
    if (settlement === undefined) {
      throw new Error(`No conversion at index ${index}`);
    }
    if (settlement.settled) {
      throw new Error(`Conversion at index ${index} is already settled`);
    }
    return settlement;
  };

  return {
    convert(postScript, options) {
      conversions.push({
        postScript,
        fileName: options.fileName,
        signal: options.signal,
      });
      options.onProgress({ kind: "started" });

      return new Promise<Uint8Array>((resolve, reject) => {
        settlements.push({ settled: false, resolve, reject });
      });
    },
    getConversions() {
      return conversions;
    },
    completeAt(index, pdf) {
      const settlement = requireUnsettled(index);
      settlement.settled = true;
      settlement.resolve(pdf);
    },
    failAt(index, error) {
      const settlement = requireUnsettled(index);
      settlement.settled = true;
      settlement.reject(error);
    },
  };
}
