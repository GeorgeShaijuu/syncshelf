"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Plus,
  CheckSquare,
  Copy,
  Check,
  Bookmark,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { LaneDefinition } from "./board-lane";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";
import { cn } from "@/lib/utils";

interface LaneActionMenuProps {
  lane: LaneDefinition;
  items: ClipboardItem[];
  canManage: boolean;
  isMaximised?: boolean;
  onAddItem?: (laneId: string) => void;
  onSelectLaneItems?: (itemIds: string[]) => void;
  onBatchPin?: (items: ClipboardItem[]) => void;
  onMaximiseLane?: (laneId: ClipboardItemType) => void;
  onRestoreBoard?: () => void;
}

export function LaneActionMenu({
  lane,
  items,
  canManage,
  isMaximised = false,
  onAddItem,
  onSelectLaneItems,
  onBatchPin,
  onMaximiseLane,
  onRestoreBoard,
}: LaneActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  const handleCopyLane = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const summary = items
        .map((i) => i.title || i.content || i.originalFileName || "")
        .filter(Boolean)
        .join("\n\n");
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 700);
    } catch (err) {
      console.error("Failed to copy lane summary:", err);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectLaneItems) {
      onSelectLaneItems(items.map((i) => i.id));
    }
    setIsOpen(false);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddItem) {
      onAddItem(lane.id);
    }
    setIsOpen(false);
  };

  const handlePinAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBatchPin && items.length > 0) {
      onBatchPin(items);
    }
    setIsOpen(false);
  };

  const handleToggleMaximise = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMaximised) {
      if (onRestoreBoard) onRestoreBoard();
    } else {
      if (onMaximiseLane) onMaximiseLane(lane.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label={`${lane.title} options`}
        aria-expanded={isOpen}
        title="Lane options"
        className={cn(
          "h-6 w-6 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90 text-[#77736D] hover:text-[#151515] hover:bg-[#EAE4D8]",
          isOpen && "bg-[#EAE4D8] text-[#151515]"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] rounded-xl bg-[#FFFEFB] border border-[#E8E2D6] p-1.5 select-none shadow-[0_12px_32px_rgba(20,15,10,0.14),0_4px_10px_rgba(20,15,10,0.06)] animate-pop-in text-[#151515]"
        >
          {/* 1. Add item */}
          <button
            type="button"
            role="menuitem"
            onClick={handleAdd}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-[#F28A32] group-hover:scale-110 transition-transform" />
              Add {lane.title.toLowerCase()}
            </span>
          </button>

          {/* 2. Select all in lane */}
          {items.length > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={handleSelectAll}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                Select all ({items.length})
              </span>
            </button>
          )}

          {/* 3. Copy lane summary */}
          {items.length > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={handleCopyLane}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                )}
                {copied ? "Copied!" : "Copy lane items"}
              </span>
            </button>
          )}

          {/* 4. Pin / Unpin all */}
          {canManage && items.length > 0 && onBatchPin && (
            <button
              type="button"
              role="menuitem"
              onClick={handlePinAll}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                Pin / Unpin all
              </span>
            </button>
          )}

          {/* Divider */}
          <div className="my-1 border-t border-[#F0EBE1]" />

          {/* 5. Maximise Lane / Restore Board */}
          <button
            type="button"
            role="menuitem"
            onClick={handleToggleMaximise}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#151515] hover:bg-[#FFE0C9]/40 hover:text-[#E84B35] transition-colors cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              {isMaximised ? (
                <Minimize2 className="h-3.5 w-3.5 text-[#F28A32] group-hover:scale-110 transition-transform" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-[#F28A32] group-hover:scale-110 transition-transform" />
              )}
              {isMaximised ? "Restore board view" : "Maximise lane"}
            </span>
            <span className="text-[10px] text-[#A09B92] font-normal">Esc</span>
          </button>
        </div>
      )}
    </div>
  );
}
