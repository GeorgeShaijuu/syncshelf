"use client";

import * as React from "react";

/**
 * SmoothScrollProvider passes through children using native browser GPU-accelerated scrolling.
 * This guarantees nested scroll containers (Board canvas, card lanes, code blocks,
 * and Settings / Team / Shares pages) respond to mouse wheel and trackpad gestures.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
