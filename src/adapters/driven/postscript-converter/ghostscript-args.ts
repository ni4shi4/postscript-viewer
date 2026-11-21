export const GS_PDF_DEVICE = "-sDEVICE=pdfwrite" as const;
export const GS_SAFER = "-dSAFER" as const;
export const GS_NO_PAUSE = "-dNOPAUSE" as const;
export const GS_BATCH = "-dBATCH" as const;

export const GS_PDFWRITE_ARGS = [GS_PDF_DEVICE, GS_SAFER, GS_NO_PAUSE, GS_BATCH] as const;
