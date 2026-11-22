import { useEffect, useRef, useState } from "preact/hooks";

import type { ByteLimitKind } from "../../../core/domain/limits";
import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { selectedViewerDocument } from "../../../core/state/viewer-state";
import { byteLimitParenthetical, conversionTimeLimitParenthetical } from "./limit-display-text";

const STATUS_PROGRESS_CLASS = "viewer-status--progress";
const STATUS_ERROR_CLASS = "viewer-status--error";

const CONVERTING_MESSAGE = "PostScript を PDF に変換しています…";

const EMPTY_VIEWER_STATE: ViewerState = {
  documents: [],
  selectedDocumentId: undefined,
};

export type ViewerDom = {
  fileInput: HTMLInputElement;
  fileNameDisplay: HTMLParagraphElement;
  pdfFrame: HTMLIFrameElement;
  statusPanel: HTMLParagraphElement;
};

export function queryViewerDom(): ViewerDom {
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  const fileNameDisplay = document.querySelector<HTMLParagraphElement>("[data-viewer-file-name]");
  const pdfFrame = document.querySelector<HTMLIFrameElement>("iframe");
  const statusPanel = document.querySelector<HTMLParagraphElement>("[data-viewer-status]");

  if (fileInput === null || fileNameDisplay === null || pdfFrame === null || statusPanel === null) {
    throw new Error("Required page elements are missing");
  }

  return { fileInput, fileNameDisplay, pdfFrame, statusPanel };
}

function userMessageForNotGzipError(): string {
  return "gzip 形式ではありません。.gz ファイルは gzip 圧縮された PostScript を選んでください";
}

function userMessageForConversionTimeout(): string {
  return `変換が${conversionTimeLimitParenthetical()}を超えました`;
}

function userMessageForTooLargeLimit(limit: ByteLimitKind): string {
  if (limit === "input") {
    return `ファイルサイズが${byteLimitParenthetical(limit)}を超えています`;
  }
  return `展開後のサイズが${byteLimitParenthetical(limit)}を超えています`;
}

export function userMessageFromViewerError(error: ViewerError): string {
  switch (error.kind) {
    case "not-gzip":
      return userMessageForNotGzipError();
    case "too-large":
      return userMessageForTooLargeLimit(error.limit);
    case "timeout":
      return userMessageForConversionTimeout();
    case "conversion-failed":
      return error.detail;
  }
}

type ViewerFileNamePresentation = {
  hidden: boolean;
  text: string;
};

export function viewerFileNamePresentation(state: ViewerState): ViewerFileNamePresentation {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument === undefined) {
    return { hidden: true, text: "" };
  }

  return { hidden: false, text: viewerDocument.fileName };
}

type ViewerStatusPresentation = {
  hidden: boolean;
  message: string;
  progress: boolean;
  error: boolean;
};

export function viewerStatusPresentation(state: ViewerState): ViewerStatusPresentation {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument === undefined) {
    return { hidden: true, message: "", progress: false, error: false };
  }

  switch (viewerDocument.status.kind) {
    case "converting":
      return {
        hidden: false,
        message: CONVERTING_MESSAGE,
        progress: true,
        error: false,
      };
    case "ready":
      return { hidden: true, message: "", progress: false, error: false };
    case "error":
      return {
        hidden: false,
        message: userMessageFromViewerError(viewerDocument.status.error),
        progress: false,
        error: true,
      };
    default: {
      const unreachable: never = viewerDocument.status;
      return unreachable;
    }
  }
}

export function viewerStatusClassName(progress: boolean, error: boolean): string {
  const classes = ["viewer-status"];
  if (progress) {
    classes.push(STATUS_PROGRESS_CLASS);
  }
  if (error) {
    classes.push(STATUS_ERROR_CLASS);
  }
  return classes.join(" ");
}

export function resetFileInputSelection(fileInput: HTMLInputElement): void {
  fileInput.value = "";
}

function logViewerErrorIfNeeded(
  state: ViewerState,
  lastLoggedErrorKey: { current: string | undefined },
): void {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument?.status.kind !== "error") {
    lastLoggedErrorKey.current = undefined;
    return;
  }

  const message = userMessageFromViewerError(viewerDocument.status.error);
  const errorKey = `${viewerDocument.id}:${message}`;
  if (lastLoggedErrorKey.current === errorKey) {
    return;
  }

  console.error(message);
  lastLoggedErrorKey.current = errorKey;
}

function bindFileInputToViewerApp(fileInput: HTMLInputElement, app: ViewerApp): () => void {
  const onChange = (): void => {
    const file = fileInput.files?.[0];
    if (file === undefined) {
      return;
    }

    void (async () => {
      const data = new Uint8Array(await file.arrayBuffer());
      await app.openPostScript({ fileName: file.name, data });
    })().finally(() => {
      resetFileInputSelection(fileInput);
    });
  };

  fileInput.addEventListener("change", onChange);
  return () => {
    fileInput.removeEventListener("change", onChange);
  };
}

export function useViewerDomUi(
  app: ViewerApp | undefined,
  fileInputRef: { readonly current: HTMLInputElement | null },
): ViewerState {
  const [state, setState] = useState<ViewerState>(EMPTY_VIEWER_STATE);
  const lastLoggedErrorKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (app === undefined) {
      setState(EMPTY_VIEWER_STATE);
      lastLoggedErrorKey.current = undefined;
      return;
    }

    const keyHolder = { current: lastLoggedErrorKey.current };
    const syncState = (next: ViewerState): void => {
      setState(next);
      logViewerErrorIfNeeded(next, keyHolder);
      lastLoggedErrorKey.current = keyHolder.current;
    };

    syncState(app.getState());
    return app.subscribe(syncState);
  }, [app]);

  useEffect(() => {
    const fileInput = fileInputRef.current;
    if (fileInput === null || app === undefined) {
      return;
    }

    return bindFileInputToViewerApp(fileInput, app);
  }, [app, fileInputRef]);

  return state;
}

export function ViewerFileName({ state }: { state: ViewerState }) {
  const presentation = viewerFileNamePresentation(state);

  return (
    <p
      class="viewer-file-name"
      data-viewer-file-name
      data-testid="viewer-file-name"
      hidden={presentation.hidden}
    >
      {presentation.text}
    </p>
  );
}

export function ViewerStatus({ state }: { state: ViewerState }) {
  const presentation = viewerStatusPresentation(state);

  return (
    <p
      class={viewerStatusClassName(presentation.progress, presentation.error)}
      data-viewer-status
      data-testid="viewer-status"
      role="status"
      aria-live="polite"
      hidden={presentation.hidden}
    >
      {presentation.message}
    </p>
  );
}
