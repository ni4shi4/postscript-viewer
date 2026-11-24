import type { Messages } from "./messages";

export const ja = {
  intlLocale: "ja-JP",
  formatSeconds: (seconds) => `${seconds} 秒`,

  appTitle: "PostScript ビューア",
  appDescription: "PostScript ファイルをブラウザ内で PDF に変換して表示します",

  convertingStatus: "PostScript を PDF に変換しています…",
  notGzipError:
    "gzip 形式ではありません。.gz ファイルは gzip 圧縮された PostScript を選んでください",
  conversionTimeout: (limit) => `変換が制限時間（${limit}）を超えました`,
  inputTooLarge: (limit) => `ファイルサイズが上限（${limit}）を超えています`,
  decompressedTooLarge: (limit) => `展開後のサイズが上限（${limit}）を超えています`,
  conversionFailed: (detail) => `PostScript を PDF に変換できませんでした（${detail}）`,

  limitsNoticeLabel: "受け付ける上限",
  limitLabelInputSize: "ファイルサイズ",
  limitLabelDecompressedSize: "展開後のサイズ",
  limitLabelConversionTime: "変換の制限時間",

  privacyNotice: "ファイルはサーバーへ送信されず、お使いの端末内で処理されます",
  trustNotice: "信頼できる PostScript ファイルだけを開いてください",

  pdfFrameTitle: "変換された PDF",
  dropOverlayLabel: "ここにドロップして変換",
  dropCardHeading: "PostScript ファイルをここにドロップ",
  dropCardFormats: ".ps / .ps.gz に対応しています",
  dropCardOr: "または",
  pickFileButton: "ファイルを選択",
  fileInputLabel: "PostScript ファイルを選択",

  historyButton: "履歴",
  convertButton: "変換",
  historyHeading: "変換履歴",
  historyOpenLabel: "履歴を開く",
  historyCloseLabel: "履歴を閉じる",
  convertAnotherRail: "変換する",
  convertAnotherFile: "別のファイルを変換",
  clearHistory: "すべて削除",
  closeLabel: "閉じる",
  removeFromHistory: (fileName) => `${fileName} を履歴から削除`,

  downloadButton: "ダウンロード",
  downloadPdfLabel: (fileName) => `${fileName} をダウンロード`,

  sourceCodeLink: "ソースコード",
  alternateLanguage: { label: "English", href: "/en/", lang: "en" },
} satisfies Messages;
