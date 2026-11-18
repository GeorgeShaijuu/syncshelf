"use client";

import * as React from "react";

export type BoardInteractionTool = "pointer" | "hand" | "select";

interface BoardContextValue {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTool: BoardInteractionTool;
  setActiveTool: (tool: BoardInteractionTool) => void;
  toggleHandTool: () => void;
  toggleSelectTool: () => void;
  isBookmarkOnly: boolean;
  toggleBookmarkOnly: () => void;
  selectedItemIds: Set<string>;
  toggleSelectItem: (id: string) => void;
  selectAllItems: (ids: string[]) => void;
  clearSelection: () => void;
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
}

const BoardContext = React.createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTool, setActiveTool] = React.useState<BoardInteractionTool>("pointer");
  const [isBookmarkOnly, setIsBookmarkOnly] = React.useState(false);
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(new Set());
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false);

  const toggleHandTool = React.useCallback(() => {
    setActiveTool((prev) => (prev === "hand" ? "pointer" : "hand"));
  }, []);

  const toggleSelectTool = React.useCallback(() => {
    setActiveTool((prev) => {
      if (prev === "select") {
        setSelectedItemIds(new Set());
        return "pointer";
      }
      return "select";
    });
  }, []);

  const toggleBookmarkOnly = React.useCallback(() => {
    setIsBookmarkOnly((prev) => !prev);
  }, []);

  const toggleSelectItem = React.useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllItems = React.useCallback((ids: string[]) => {
    setSelectedItemIds(new Set(ids));
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const value = React.useMemo<BoardContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      activeTool,
      setActiveTool,
      toggleHandTool,
      toggleSelectTool,
      isBookmarkOnly,
      toggleBookmarkOnly,
      selectedItemIds,
      toggleSelectItem,
      selectAllItems,
      clearSelection,
      quickCaptureOpen,
      setQuickCaptureOpen,
    }),
    [
      searchQuery,
      activeTool,
      isBookmarkOnly,
      selectedItemIds,
      toggleHandTool,
      toggleSelectTool,
      toggleBookmarkOnly,
      toggleSelectItem,
      selectAllItems,
      clearSelection,
      quickCaptureOpen,
      setQuickCaptureOpen,
    ]
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const ctx = React.useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard must be used within a BoardProvider");
  }
  return ctx;
}
