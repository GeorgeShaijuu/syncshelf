/**
 * Unified Clipboard Capture Service
 * Intercepts and parses ClipboardEvents, DragEvents, and DataTransfer objects.
 */

import { classifyFile, ClassifiedFile } from "./file-classifier";
import { detectContent, DetectedContentResult } from "./content-detector";

export interface CapturedFileItem extends ClassifiedFile {
  file: File;
}

export type CapturedClipboardPayload =
  | {
      kind: "files";
      files: CapturedFileItem[];
    }
  | {
      kind: "content";
      content: DetectedContentResult;
    }
  | {
      kind: "empty";
    };

/**
 * Extracts files or text from DataTransfer (ClipboardData or DragData).
 */
export function extractDataTransferPayload(
  dataTransfer: DataTransfer | null
): CapturedClipboardPayload {
  if (!dataTransfer) {
    return { kind: "empty" };
  }

  // 1. Check for files (pasted screenshots, image data, dragged local files)
  const files: CapturedFileItem[] = [];

  // Check dataTransfer.files
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (file && file.size > 0) {
        const classified = classifyFile(file);
        files.push({ ...classified, file });
      }
    }
  }

  // Check dataTransfer.items if files list was empty or to catch image blobs
  if (files.length === 0 && dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          const classified = classifyFile(file);
          files.push({ ...classified, file });
        }
      }
    }
  }

  if (files.length > 0) {
    return {
      kind: "files",
      files,
    };
  }

  // 2. Extract text data
  let text = dataTransfer.getData("text/plain") || "";
  if (!text) {
    text = dataTransfer.getData("text/uri-list") || "";
  }
  if (!text) {
    // If text/html is present but text/plain is missing, extract plain text representation
    const html = dataTransfer.getData("text/html");
    if (html) {
      const div = typeof document !== "undefined" ? document.createElement("div") : null;
      if (div) {
        div.innerHTML = html;
        text = div.textContent || div.innerText || "";
      }
    }
  }

  if (text.trim()) {
    const detected = detectContent(text);
    return {
      kind: "content",
      content: detected,
    };
  }

  return { kind: "empty" };
}
