"use client";

import * as React from "react";
import { ClipboardItem } from "@/lib/validation/item";
import { formatSelectedDateDisplay, getSelectedDateHeading } from "./calendar-utils";
import { Copy, Check, Bookmark, Inbox } from "lucide-react";
import { getRelativeTimeString } from "@/features/clipboard/board/board-card-renderers";
import { cn } from "@/lib/utils";

interface CalendarDayGridProps {
  selectedDateString: string;
  items: ClipboardItem[];
  canManage: boolean;
  onPinToggle: (item: ClipboardItem) => void;
  onAddItem: () => void;
}

export function CalendarDayGrid({
  selectedDateString,
  items,
  canManage,
  onPinToggle,
  onAddItem,
}: CalendarDayGridProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const heading = getSelectedDateHeading(selectedDateString);
  const formattedDate = formatSelectedDateDisplay(selectedDateString);

  const handleCopy = async (e: React.MouseEvent, item: ClipboardItem) => {
    e.stopPropagation();
    try {
      const text = item.content || item.title || "";
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFFEFA] rounded-2xl border border-[#EDE5D9] p-5 shadow-xs">
      {/* Day Overview Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EDE5D9]/70 shrink-0">
        <div>
          <h3 className="text-base font-bold text-[#24211F]">{heading}</h3>
          <p className="text-xs text-[#817A72]">{formattedDate}</p>
        </div>
        <div className="text-xs font-semibold text-[#817A72]">
          {items.length} {items.length === 1 ? "clip" : "clips"} on this date
        </div>
      </div>

      {/* Items Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1 scrollbar-thin">
        {items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-[#DDD5C7] bg-[#FAF7F0]/50">
            <Inbox className="h-8 w-8 mb-2 opacity-40 text-[#817A72]" />
            <h4 className="text-sm font-bold text-[#24211F]">No clips for this day</h4>
            <p className="text-xs text-[#817A72] mt-1 max-w-xs">
              Press Ctrl+V or click Paste in the right panel to capture anything directly onto this date.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  "clay-card p-4 flex items-start justify-between gap-4 transition-all",
                  item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F58B35] bg-[#FFE4D0] px-2 py-0.5 rounded-full">
                      {item.type}
                    </span>
                    <h4 className="text-sm font-semibold text-[#24211F] truncate">
                      {item.title}
                    </h4>
                  </div>
                  {item.content && item.content !== item.title && (
                    <p className="text-xs text-[#817A72] line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span className="text-xs text-[#AAA197]">
                    {getRelativeTimeString(item.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, item)}
                    title="Quick copy"
                    className="clay-icon-btn h-7 w-7 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPinToggle(item)}
                    title={item.isPinned ? "Unpin" : "Pin"}
                    className="clay-icon-btn h-7 w-7 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
                  >
                    <Bookmark
                      className={cn(
                        "h-3.5 w-3.5",
                        item.isPinned && "fill-current text-[#F58B35]"
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
