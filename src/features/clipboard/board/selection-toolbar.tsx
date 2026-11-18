"use client";

import * as React from "react";
import {
  Share2,
  Trash2,
  Pin,
  CheckSquare,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchPin?: () => void;
  onBatchShare?: () => void;
  onBatchDelete?: () => void;
  loading?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchPin,
  onBatchShare,
  onBatchDelete,
  loading = false,
}: SelectionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-[#E7E0D2] bg-[#FFFEFB]/95 backdrop-blur-md shadow-[0_12px_32px_rgba(25,18,10,0.12),0_4px_12px_rgba(25,18,10,0.06)] animate-in slide-in-from-bottom-5 duration-200 select-none text-[#151515]">
      <div className="flex items-center gap-2 pr-2 border-r border-[#EAE4D8] text-xs">
        <CheckSquare className="h-4 w-4 text-[#F28A32]" />
        <span className="font-semibold text-[#151515]">
          {selectedCount} of {totalCount} selected
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSelectAll}
          className="h-8 px-2.5 rounded-xl text-xs font-semibold text-[#151515] hover:bg-[#F3EFE8] active:scale-95 transition-all cursor-pointer"
        >
          Select All
        </button>

        {onBatchPin && (
          <button
            type="button"
            onClick={onBatchPin}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#E7E0D2] bg-white text-xs font-medium text-[#151515] hover:bg-[#F3EFE8] active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <Pin className="h-3.5 w-3.5 text-[#F28A32]" />
            <span>Pin</span>
          </button>
        )}

        {onBatchShare && (
          <button
            type="button"
            onClick={onBatchShare}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#E7E0D2] bg-white text-xs font-medium text-[#151515] hover:bg-[#F3EFE8] active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Create Share</span>
          </button>
        )}

        {onBatchDelete && (
          <button
            type="button"
            onClick={onBatchDelete}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#FFE0D9] bg-[#FFF8F7] text-xs font-medium text-[#E84B35] hover:bg-[#FFEBE8] active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        )}
      </div>

      <div className="pl-2 border-l border-[#EAE4D8]">
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1 rounded-lg text-[#77736D] hover:text-[#151515] hover:bg-[#F3EFE8] active:scale-90 transition-all cursor-pointer"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
