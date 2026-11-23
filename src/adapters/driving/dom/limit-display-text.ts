import {
  formattedByteLimit,
  formattedConversionTimeLimit,
  type ByteLimitKind,
} from "../../../core/domain/limits";

export function byteLimitParenthetical(kind: ByteLimitKind): string {
  return `上限（${formattedByteLimit(kind)}）`;
}

export function conversionTimeLimitParenthetical(): string {
  return `制限時間（${formattedConversionTimeLimit()}）`;
}

export type AcceptedFileLimitItem = {
  label: string;
  value: string;
};

export function acceptedFileLimitItems(): AcceptedFileLimitItem[] {
  return [
    { label: "ファイルサイズ", value: formattedByteLimit("input") },
    { label: "展開後のサイズ", value: formattedByteLimit("decompressed") },
    { label: "変換の制限時間", value: formattedConversionTimeLimit() },
  ];
}
