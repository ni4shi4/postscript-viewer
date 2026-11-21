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

export function acceptedFileLimitsDescription(): string {
  return `受け付ける上限: ファイルサイズ${byteLimitParenthetical("input")}、展開後のサイズ${byteLimitParenthetical("decompressed")}、変換は${conversionTimeLimitParenthetical()}まで`;
}
