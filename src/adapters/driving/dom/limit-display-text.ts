import { conversionTimeLimitInSeconds, formattedByteLimit } from "../../../core/domain/limits";
import type { Messages } from "./i18n/messages";

export function formattedConversionTimeLimit(messages: Messages): string {
  return messages.formatSeconds(conversionTimeLimitInSeconds());
}

export type AcceptedFileLimitItem = {
  label: string;
  value: string;
};

export function acceptedFileLimitItems(messages: Messages): AcceptedFileLimitItem[] {
  return [
    { label: messages.limitLabelInputSize, value: formattedByteLimit("input") },
    { label: messages.limitLabelDecompressedSize, value: formattedByteLimit("decompressed") },
    { label: messages.limitLabelConversionTime, value: formattedConversionTimeLimit(messages) },
  ];
}
