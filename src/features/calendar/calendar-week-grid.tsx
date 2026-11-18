"use client";

import * as React from "react";
import { CalendarDayInfo } from "./calendar-types";
import { ClipboardItem } from "@/lib/validation/item";
import { getRelativeTimeString } from "@/features/clipboard/board/board-card-renderers";
import { Copy, Check, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarWeekGridProps {
  days: CalendarDayInfo[];
  onSelectDate: (dateString: string) => void;
  onPinToggle: (item: ClipboardItem) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWeekGrid({
  days,
  onSelectDate,
  onPinToggle,
}: CalendarWeekGridProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

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
    <div className="flex-1 flex flex-col min-h-0">
      {/* 7 Columns for Week */}
      <div className="grid grid-cols-7 gap-2.5 h-full min-h-0">
        {days.map((day, idx) => {
          const weekdayName = WEEKDAYS[idx] || "";
          const isSelected = day.isSelected;
          const isToday = day.isToday;

          return (
            <div
              key={day.dateString}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(day.dateString)}
              className={cn(
                "flex flex-col h-full rounded-2xl border p-2.5 transition-all select-none cursor-pointer overflow-hidden",
                isSelected
                  ? "clay-cell-selected"
                  : "bg-[#FFFEFA] border-[#EDE5D9] hover:border-[#DFD5C5] hover:shadow-[0_4px_12px_rgba(36,33,31,0.03)]"
              )}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#EDE5D9]/60 shrink-0">
                <span className="text-xs font-semibold text-[#817A72]">
                  {weekdayName}
                </span>
                {isSelected ? (
                  <span className="h-5 px-1.5 rounded-full bg-gradient-to-b from-[#F99849] to-[#F58B35] text-white font-bold text-xs flex items-center justify-center shadow-[0_2px_4px_rgba(245,139,53,0.3)]">
                    {day.dayNumber}
                  </span>
                ) : isToday ? (
                  <span className="text-xs font-bold text-[#F58B35]">
                    {day.dayNumber}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#24211F]">
                    {day.dayNumber}
                  </span>
                )}
              </div>

              {/* Items List inside Day Column */}
              <div className="flex-1 overflow-y-auto space-y-2 pt-2 scrollbar-thin pr-0.5">
                {day.items.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-center text-[11px] text-[#AAA197]">
                    No clips
                  </div>
                ) : (
                  day.items.map((item) => {
                    const isCopied = copiedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-xl bg-white border border-[#EDE5D9] p-2 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-1.5"
                      >
                        <h5 className="text-[11.5px] font-semibold text-[#24211F] line-clamp-2 leading-tight">
                          {item.title}
                        </h5>
                        {item.content && item.content !== item.title && (
                          <p className="text-[10.5px] text-[#817A72] line-clamp-2 leading-relaxed">
                            {item.content}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-[#F5EFE5] text-[10px] text-[#AAA197]">
                          <span>{getRelativeTimeString(item.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, item)}
                              title="Copy"
                              className="h-5 w-5 rounded flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5] transition-colors"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPinToggle(item);
                              }}
                              title="Pin"
                              className="h-5 w-5 rounded flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5] transition-colors"
                            >
                              <Bookmark
                                className={cn(
                                  "h-3 w-3",
                                  item.isPinned && "fill-current text-[#F58B35]"
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
