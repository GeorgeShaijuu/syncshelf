/**
 * Paste and Drag Event Handlers
 * Attaches global and element-level listeners while respecting active input fields.
 */

import * as React from "react";
import {
  extractDataTransferPayload,
  CapturedClipboardPayload,
} from "./clipboard-capture";

/**
 * Checks if the target element is an interactive input, textarea, or contentEditable.
 * When true, global paste listeners MUST NOT intercept the event.
 */
export function isEditableElement(target: any): boolean {
  if (!target) {
    return false;
  }

  if (typeof HTMLElement !== "undefined" && !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = (target.tagName || "").toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  // Check roles or parent editable attributes
  const role = typeof target.getAttribute === "function" ? target.getAttribute("role") : null;
  if (role === "textbox" || role === "searchbox") {
    return true;
  }

  if (typeof target.closest === "function" && target.closest("input, textarea, [contenteditable='true'], [role='textbox']")) {
    return true;
  }

  return false;
}

interface UseGlobalPasteOptions {
  onCapture: (payload: CapturedClipboardPayload) => void | Promise<void>;
  enabled?: boolean;
}

/**
 * Global keyboard paste (Ctrl+V / Cmd+V) listener.
 * Bypasses capturing when the user is actively typing in an input element.
 */
export function useGlobalPasteCapture({
  onCapture,
  enabled = true,
}: UseGlobalPasteOptions) {
  const onCaptureRef = React.useRef(onCapture);
  onCaptureRef.current = onCapture;

  React.useEffect(() => {
    if (!enabled) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      // If user is inside an input, textarea, or contentEditable, do not intercept
      if (isEditableElement(e.target)) {
        return;
      }

      if (!e.clipboardData) return;

      const payload = extractDataTransferPayload(e.clipboardData);
      if (payload.kind !== "empty") {
        e.preventDefault();
        onCaptureRef.current(payload);
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [enabled]);
}
