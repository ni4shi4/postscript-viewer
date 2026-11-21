import { describe, expect, it } from "vitest";

import { GS_PDFWRITE_ARGS, GS_SAFER } from "./ghostscript-args";

describe("GS_PDFWRITE_ARGS", () => {
  it("includes -dSAFER and omits -dNOSAFER", () => {
    expect(GS_PDFWRITE_ARGS).toContain(GS_SAFER);
    expect(GS_PDFWRITE_ARGS).not.toContain("-dNOSAFER");
  });
});
