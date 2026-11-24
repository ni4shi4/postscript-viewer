import { useEffect, useRef, useState } from "preact/hooks";

import { formattedByteLimit } from "../../../core/domain/limits";
import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { selectedViewerDocument } from "../../../core/state/viewer-state";
import { useMessages } from "./i18n/messages-context";
import type { Messages } from "./i18n/messages";
import { formattedConversionTimeLimit } from "./limit-display-text";

const STATUS_PROGRESS_CLASS = "viewer-status--progress";
const STATUS_ERROR_CLASS = "viewer-status--error";

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

export function userMessageFromViewerError(error: ViewerError, messages: Messages): string {
  switch (error.kind) {
    case "not-gzip":
      return messages.notGzipError;
    case "too-large":
      return error.limit === "input"
        ? messages.inputTooLarge(formattedByteLimit(error.limit))
        : messages.decompressedTooLarge(formattedByteLimit(error.limit));
    case "timeout":
      return messages.conversionTimeout(formattedConversionTimeLimit(messages));
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

export function viewerStatusPresentation(
  state: ViewerState,
  messages: Messages,
): ViewerStatusPresentation {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument === undefined) {
    return { hidden: true, message: "", progress: false, error: false };
  }

  switch (viewerDocument.status.kind) {
    case "converting":
      return {
        hidden: false,
        message: messages.convertingStatus,
        progress: true,
        error: false,
      };
    case "ready":
      return { hidden: true, message: "", progress: false, error: false };
    case "error":
      return {
        hidden: false,
        message: userMessageFromViewerError(viewerDocument.status.error, messages),
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
  messages: Messages,
): void {
  const viewerDocument = selectedViewerDocument(state);
  if (viewerDocument?.status.kind !== "error") {
    lastLoggedErrorKey.current = undefined;
    return;
  }

  const message = userMessageFromViewerError(viewerDocument.status.error, messages);
  const errorKey = `${viewerDocument.id}:${message}`;
  if (lastLoggedErrorKey.current === errorKey) {
    return;
  }

  console.error(message);
  lastLoggedErrorKey.current = errorKey;
}

async function openPostScriptFile(app: ViewerApp, file: File): Promise<void> {
  const data = new Uint8Array(await file.arrayBuffer());
  await app.openPostScript({ fileName: file.name, data });
}

function bindFileInputToViewerApp(fileInput: HTMLInputElement, app: ViewerApp): () => void {
  const onChange = (): void => {
    const file = fileInput.files?.[0];
    if (file === undefined) {
      return;
    }

    void openPostScriptFile(app, file).finally(() => {
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
  const messages = useMessages();
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
      logViewerErrorIfNeeded(next, keyHolder, messages);
      lastLoggedErrorKey.current = keyHolder.current;
    };

    syncState(app.getState());
    return app.subscribe(syncState);
  }, [app, messages]);

  useEffect(() => {
    const fileInput = fileInputRef.current;
    if (fileInput === null || app === undefined) {
      return;
    }

    return bindFileInputToViewerApp(fileInput, app);
  }, [app, fileInputRef]);

  return state;
}

function hasDraggedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

// 表示領域の外（サイドバーなど）にドロップしても、ブラウザが既定動作でファイルを開かないようにする。
export function usePreventBrowserFileDrop(): void {
  useEffect(() => {
    const prevent = (event: DragEvent): void => {
      if (hasDraggedFiles(event)) {
        event.preventDefault();
      }
    };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);
}

export type FileDropTarget = {
  dragging: boolean;
  handlers: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
};

export function useFileDropTarget(app: ViewerApp | undefined): FileDropTarget {
  const [dragging, setDragging] = useState(false);
  // 子要素をまたぐ移動で dragenter / dragleave が対になって発火するため、深さを数えて判定する。
  const depth = useRef(0);

  const endDrag = (): void => {
    depth.current = 0;
    setDragging(false);
  };

  return {
    dragging,
    handlers: {
      onDragEnter(event) {
        if (!hasDraggedFiles(event)) {
          return;
        }
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver(event) {
        if (!hasDraggedFiles(event)) {
          return;
        }
        event.preventDefault();
      },
      onDragLeave(event) {
        if (!hasDraggedFiles(event)) {
          return;
        }
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) {
          setDragging(false);
        }
      },
      onDrop(event) {
        if (!hasDraggedFiles(event)) {
          return;
        }
        event.preventDefault();
        endDrag();
        const file = event.dataTransfer?.files?.[0];
        if (file === undefined || app === undefined) {
          return;
        }
        void openPostScriptFile(app, file);
      },
    },
  };
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
  const messages = useMessages();
  const presentation = viewerStatusPresentation(state, messages);

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
