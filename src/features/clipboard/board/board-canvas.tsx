"use client";

import * as React from "react";
import { BOARD_LANES, BoardLane } from "./board-lane";
import { BoardLaneSkeleton } from "@/components/ui/lottie-skeleton";
import { FocusExpandedLane } from "./focus-expanded-lane";
import { FocusMinimisedPanel } from "./focus-minimised-panel";
import { SelectionToolbar } from "./selection-toolbar";
import { useBoard } from "./board-context";
import { EditItemModal } from "@/features/clipboard/edit-item-modal";
import { DeleteItemDialog } from "@/features/clipboard/delete-item-dialog";
import { CreateShareModal } from "@/features/shares/create-share-modal";
import { QuickCaptureModal } from "@/features/clipboard/quick-capture-modal";
import { Workspace } from "@/features/workspaces/workspace-context";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { cn } from "@/lib/utils";

interface BoardCanvasProps {
  workspace: Workspace;
  items: ClipboardItem[];
  loading: boolean;
  canManage: boolean;
  onPinToggle: (item: ClipboardItem) => void;
  onItemCreated: (item: ClipboardItem) => void;
  onItemUpdated: (item: ClipboardItem) => void;
  onItemDeleted: (id: string) => void;
  customUpdateUrl?: (item: ClipboardItem) => string;
  customDeleteUrl?: (item: ClipboardItem) => string;
  customCreateUrl?: string;
}

export function BoardCanvas({
  workspace,
  items,
  loading,
  canManage,
  onPinToggle,
  onItemCreated,
  onItemUpdated,
  onItemDeleted,
  customUpdateUrl,
  customDeleteUrl,
  customCreateUrl,
}: BoardCanvasProps) {
  const {
    searchQuery,
    activeTool,
    toggleSelectTool,
    isBookmarkOnly,
    selectedItemIds,
    toggleSelectItem,
    selectAllItems,
    clearSelection,
    quickCaptureOpen,
    setQuickCaptureOpen,
  } = useBoard();

  const boardRef = React.useRef<HTMLDivElement | null>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const [dragStartX, setDragStartX] = React.useState(0);
  const [dragScrollLeft, setDragScrollLeft] = React.useState(0);

  // Bottom scrollbar indicator state (0 to 1)
  const [scrollRatio, setScrollRatio] = React.useState(0);

  // Active selected lane block (when selected, mouse wheel scrolls that lane vertically)
  const [activeLaneId, setActiveLaneId] = React.useState<ClipboardItemType | null>(null);

  // Focus Mode / Maximise Lane state
  const [maximisedLaneId, setMaximisedLaneId] = React.useState<ClipboardItemType | null>(null);

  // Keyboard shortcut: Escape restores normal board mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && maximisedLaneId) {
        setMaximisedLaneId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximisedLaneId]);

  const maximisedLane = React.useMemo(() => {
    if (!maximisedLaneId) return null;
    return BOARD_LANES.find((l) => l.id === maximisedLaneId) || null;
  }, [maximisedLaneId]);

  // Modals state
  const [editingItem, setEditingItem] = React.useState<ClipboardItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<ClipboardItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [shareItemIds, setShareItemIds] = React.useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = React.useState(false);

  // Listen to board scroll to update bottom slider
  const handleScroll = () => {
    if (!boardRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = boardRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollRatio(Math.min(Math.max(scrollLeft / maxScroll, 0), 1));
    }
  };

  // Slider track reference and drag state
  const sliderTrackRef = React.useRef<HTMLDivElement | null>(null);
  const [isSliderDragging, setIsSliderDragging] = React.useState(false);

  // Drag-to-scroll across board on mouse move
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore right clicks or clicks on interactive inputs/buttons/links/menus
    if (e.button === 2) return;
    const target = e.target as HTMLElement | null;
    const isInteractive = target?.closest(
      "button, a, input, textarea, select, [role='menu'], [role='menuitem']"
    );
    if (isInteractive) return;

    const isCanvasBg = target?.classList.contains("board-canvas-bg");
    const isLaneHeaderOrTray = target?.closest(".board-lane-container");
    const isInsideCardScroll = target?.closest(".lane-cards-scroll");

    // Initiate drag if Hand tool is active, middle button, or clicking canvas background / lane headers
    if (
      activeTool === "hand" ||
      e.button === 1 ||
      isCanvasBg ||
      (isLaneHeaderOrTray && !isInsideCardScroll)
    ) {
      if (!boardRef.current) return;
      setIsMouseDown(true);
      setDragStartX(e.pageX - boardRef.current.offsetLeft);
      setDragScrollLeft(boardRef.current.scrollLeft);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !boardRef.current) return;
    e.preventDefault();
    const x = e.pageX - boardRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    boardRef.current.scrollLeft = dragScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  // Horizontal mouse wheel navigation across the entire board
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;
    // Active lanes and code blocks stop propagation internally.
    // Anywhere else on the board, mouse wheel smoothly pans horizontally across all lanes!
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta !== 0) {
      boardRef.current.scrollLeft += delta * 1.35;
    }
  };

  // Update board position from bottom slider position
  const updateScrollFromSlider = React.useCallback((clientX: number) => {
    if (!sliderTrackRef.current || !boardRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxScroll = boardRef.current.scrollWidth - boardRef.current.clientWidth;
    boardRef.current.scrollLeft = clickRatio * maxScroll;
  }, []);

  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSliderDragging(true);
    updateScrollFromSlider(e.clientX);
  };

  React.useEffect(() => {
    if (!isSliderDragging) return;
    const handleWindowMouseMove = (e: MouseEvent) => {
      updateScrollFromSlider(e.clientX);
    };
    const handleWindowMouseUp = () => {
      setIsSliderDragging(false);
    };
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isSliderDragging, updateScrollFromSlider]);

  // Filter items based on active search and bookmark filter
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (!item) return false;

      // Bookmark / Pin filter
      if (isBookmarkOnly && !item.isPinned) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesContent = item.content?.toLowerCase().includes(q);
        const matchesFile = item.originalFileName?.toLowerCase().includes(q);
        const matchesLang = item.language?.toLowerCase().includes(q);
        const matchesTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));

        if (!matchesTitle && !matchesContent && !matchesFile && !matchesLang && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [items, isBookmarkOnly, searchQuery]);

  // Group items by content type lane
  const laneItemMap = React.useMemo(() => {
    const map = new Map<ClipboardItemType, ClipboardItem[]>();
    for (const lane of BOARD_LANES) {
      map.set(lane.id, []);
    }

    for (const item of filteredItems) {
      const type = item.type || "text";
      const list = map.get(type);
      if (list) {
        list.push(item);
      } else {
        map.get("file")?.push(item);
      }
    }

    // Sort items inside each lane: pinned first, then newest first
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return map;
  }, [filteredItems]);

  // Selection toolbar actions
  const handleSelectAll = () => {
    const allIds = filteredItems.map((i) => i.id).filter(Boolean);
    selectAllItems(allIds);
  };

  const handleCardShare = (item: ClipboardItem) => {
    setShareItemIds([item.id]);
    setShareModalOpen(true);
  };

  const handleBatchShare = () => {
    setShareItemIds(Array.from(selectedItemIds));
    setShareModalOpen(true);
  };

  const handleAddItemToLane = (laneId?: string) => {
    setQuickCaptureOpen(true);
  };

  const handlePasteToLane = async (laneId: string) => {
    if (!canManage) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setQuickCaptureOpen(true);
        return;
      }

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspace.id}/items`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: laneId,
          title: text.slice(0, 60).trim(),
          content: text.trim(),
          isPinned: false,
          tags: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onItemCreated(data.item || data);
      }
    } catch (err) {
      console.error("Paste to lane failed:", err);
      setQuickCaptureOpen(true);
    }
  };

  const handleSelectLaneItems = (itemIds: string[]) => {
    if (activeTool !== "select") {
      toggleSelectTool();
    }
    selectAllItems(itemIds);
  };

  const handleBatchPinLane = async (laneItems: ClipboardItem[]) => {
    if (!canManage || laneItems.length === 0) return;
    const shouldPin = laneItems.some((i) => !i.isPinned);
    try {
      const headers = await getAuthHeaders();
      for (const item of laneItems) {
        if (item.isPinned !== shouldPin) {
          await fetch(`/api/workspaces/${workspace.id}/items/${item.id}`, {
            method: "PATCH",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isPinned: shouldPin }),
          });
          onItemUpdated({ ...item, isPinned: shouldPin });
        }
      }
    } catch (err) {
      console.error("Batch pin lane failed:", err);
    }
  };

  const handleBatchPin = async () => {
    if (!canManage || selectedItemIds.size === 0) return;
    setBatchActionLoading(true);

    try {
      const headers = await getAuthHeaders();
      const targetIds = Array.from(selectedItemIds);
      for (const id of targetIds) {
        const item = items.find((i) => i.id === id);
        if (item) {
          await fetch(`/api/workspaces/${workspace.id}/items/${id}`, {
            method: "PATCH",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isPinned: !item.isPinned }),
          });
          onItemUpdated({ ...item, isPinned: !item.isPinned });
        }
      }
      clearSelection();
    } catch (err) {
      console.error("Batch pin failed:", err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!canManage || selectedItemIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.size} selected items permanently?`)) {
      return;
    }

    setBatchActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const targetIds = Array.from(selectedItemIds);
      for (const id of targetIds) {
        await fetch(`/api/workspaces/${workspace.id}/items/${id}`, {
          method: "DELETE",
          headers,
        });
        onItemDeleted(id);
      }
      clearSelection();
    } catch (err) {
      console.error("Batch delete failed:", err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const isSelectMode = activeTool === "select";

  return (
    <div className="relative flex-1 h-[calc(100vh-4.5rem)] w-full overflow-hidden select-none flex flex-col justify-between">
      {/* Either Focus Mode (Expanded Lane + Minimised Panel) OR Normal Multi-Lane Board */}
      {maximisedLaneId && maximisedLane ? (
        <div className="flex-1 w-full h-[calc(100vh-4.5rem)] pl-20 pr-6 pt-2 pb-3 flex items-start gap-4 overflow-hidden animate-in fade-in-50 duration-200">
          {/* Main Expanded Workspace */}
          <FocusExpandedLane
            lane={maximisedLane}
            items={laneItemMap.get(maximisedLane.id) || []}
            canManage={canManage}
            onRestoreBoard={() => setMaximisedLaneId(null)}
            onAddItem={() => handleAddItemToLane(maximisedLane.id)}
            onPasteToLane={handlePasteToLane}
            onPinToggle={onPinToggle}
            onEdit={setEditingItem}
            onDelete={setDeletingItem}
            onShare={handleCardShare}
          />

          {/* Right-Side Minimised Lanes Panel */}
          <FocusMinimisedPanel
            currentLaneId={maximisedLaneId}
            laneItemMap={laneItemMap}
            onSelectLane={setMaximisedLaneId}
          />
        </div>
      ) : (
        <>
          {/* Horizontally navigable Board Canvas - Stretched out with luxurious depth */}
          <div
            ref={boardRef}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
            onClick={() => setActiveLaneId(null)}
            className={cn(
              "board-canvas-bg flex-1 w-full overflow-x-auto overflow-y-hidden pl-20 pr-8 sm:pr-12 pt-3 pb-3 flex items-start gap-5 sm:gap-6 no-scrollbar",
              activeTool === "hand"
                ? isMouseDown
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : isMouseDown
                ? "cursor-grabbing"
                : "cursor-default"
            )}
          >
            {loading
              ? BOARD_LANES.map((lane) => (
                  <BoardLaneSkeleton key={lane.id} />
                ))
              : BOARD_LANES.map((lane) => {
                  const laneItems = laneItemMap.get(lane.id) || [];
                  return (
                    <BoardLane
                      key={lane.id}
                      lane={lane}
                      items={laneItems}
                      canManage={canManage}
                      isSelectMode={isSelectMode}
                      selectedItemIds={selectedItemIds}
                      isActiveLane={activeLaneId === lane.id}
                      onSelectLane={setActiveLaneId}
                      onToggleSelectItem={toggleSelectItem}
                      onPinToggle={onPinToggle}
                      onEdit={setEditingItem}
                      onDelete={setDeletingItem}
                      onShare={handleCardShare}
                      onAddItem={handleAddItemToLane}
                      onSelectLaneItems={handleSelectLaneItems}
                      onBatchPin={handleBatchPinLane}
                      onMaximiseLane={setMaximisedLaneId}
                    />
                  );
                })}
          </div>

          {/* Horizontal Scrollbar Slider at Bottom Center */}
          <div className="h-6 w-full flex items-center justify-center pb-2 pointer-events-auto">
            <div
              ref={sliderTrackRef}
              onMouseDown={handleSliderMouseDown}
              className="relative h-2 w-80 rounded-full bg-[#E6E1D8] cursor-pointer overflow-hidden shadow-inner group"
            >
              <div
                className={cn(
                  "absolute top-0 bottom-0 h-full w-28 rounded-full bg-[#C5BFB5] hover:bg-[#A8A298] transition-all duration-75 shadow-xs cursor-grab",
                  isSliderDragging && "bg-[#9A9388] cursor-grabbing"
                )}
                style={{
                  left: `calc(${scrollRatio * 100}% - ${scrollRatio * 7}rem)`,
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Floating Selection Toolbar */}
      {isSelectMode && selectedItemIds.size > 0 && (
        <SelectionToolbar
          selectedCount={selectedItemIds.size}
          totalCount={filteredItems.length}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          onBatchPin={canManage ? handleBatchPin : undefined}
          onBatchShare={handleBatchShare}
          onBatchDelete={canManage ? handleBatchDelete : undefined}
          loading={batchActionLoading}
        />
      )}

      {/* Interactive Modals */}
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        workspaceId={workspace.id}
        onClose={() => setQuickCaptureOpen(false)}
        onItemCreated={onItemCreated}
        customCreateUrl={customCreateUrl}
      />

      <EditItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onItemUpdated={onItemUpdated}
        customUpdateUrl={customUpdateUrl}
      />

      <DeleteItemDialog
        item={deletingItem}
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onItemDeleted={onItemDeleted}
        customDeleteUrl={customDeleteUrl}
      />

      {shareModalOpen && (
        <CreateShareModal
          isOpen={shareModalOpen}
          workspaceId={workspace.id}
          preselectedItemIds={shareItemIds.length > 0 ? shareItemIds : Array.from(selectedItemIds)}
          onClose={() => {
            setShareModalOpen(false);
            setShareItemIds([]);
          }}
          onShareCreated={() => {
            setShareModalOpen(false);
            setShareItemIds([]);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
