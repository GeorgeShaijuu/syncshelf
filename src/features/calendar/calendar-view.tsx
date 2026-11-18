"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Workspace } from "@/features/workspaces/workspace-context";
import { ClipboardItem } from "@/lib/validation/item";
import {
  CalendarViewMode,
  CalendarDayInfo,
} from "./calendar-types";
import {
  getMonthCalendarDays,
  getWeekCalendarDays,
} from "./calendar-utils";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarWeekGrid } from "./calendar-week-grid";
import { CalendarDayGrid } from "./calendar-day-grid";
import { CalendarSelectedPanel } from "./calendar-selected-panel";
import { ClayTabs } from "@/components/ui/clay";
import { EditItemModal } from "@/features/clipboard/edit-item-modal";
import { DeleteItemDialog } from "@/features/clipboard/delete-item-dialog";
import { CreateShareModal } from "@/features/shares/create-share-modal";
import { formatLocalDateString, getItemCalendarDate } from "@/lib/validation/item";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  workspace: Workspace;
  items: ClipboardItem[];
  canManage: boolean;
  onPinToggle: (item: ClipboardItem) => void;
  onItemUpdated: (item: ClipboardItem) => void;
  onItemDeleted: (id: string) => void;
  onPasteCapture: (dateString: string) => void;
  customUpdateUrl?: (item: ClipboardItem) => string;
  customDeleteUrl?: (item: ClipboardItem) => string;
}

const VIEW_OPTIONS: { label: string; value: CalendarViewMode }[] = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
];

export function CalendarView({
  workspace,
  items,
  canManage,
  onPinToggle,
  onItemUpdated,
  onItemDeleted,
  onPasteCapture,
  customUpdateUrl,
  customDeleteUrl,
}: CalendarViewProps) {
  // 1. Current viewed month/year date
  const [viewDate, setViewDate] = React.useState<Date>(() => new Date());

  // 2. Selected calendar date string (YYYY-MM-DD), default to today in local timezone
  const [selectedDateString, setSelectedDateString] = React.useState<string>(() =>
    formatLocalDateString(new Date())
  );

  // 3. View mode: Month | Week | Day
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("month");

  // Modal states
  const [editingItem, setEditingItem] = React.useState<ClipboardItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<ClipboardItem | null>(null);
  const [shareItemIds, setShareItemIds] = React.useState<string[] | null>(null);

  // Navigation handlers
  const handlePrev = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() - 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() - 7);
      } else {
        next.setDate(next.getDate() - 1);
        setSelectedDateString(formatLocalDateString(next));
      }
      return next;
    });
  };

  const handleNext = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
        setSelectedDateString(formatLocalDateString(next));
      }
      return next;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setViewDate(today);
    setSelectedDateString(formatLocalDateString(today));
  };

  const handleSelectDate = (dateString: string) => {
    setSelectedDateString(dateString);
    // Align viewDate to selected date
    const [y, m, d] = dateString.split("-").map(Number);
    if (y && m && d) {
      setViewDate(new Date(y, m - 1, d));
    }
  };

  // Month navigation display string: e.g. "Mar 2025" or "November 2026"
  const monthYearLabel = viewDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // Items on currently selected date
  const selectedDateItems = React.useMemo(() => {
    return items
      .filter((item) => getItemCalendarDate(item) === selectedDateString)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [items, selectedDateString]);

  // Calendar days calculation for Month view
  const monthDays = React.useMemo(() => {
    return getMonthCalendarDays(viewDate, selectedDateString, items);
  }, [viewDate, selectedDateString, items]);

  // Calendar days calculation for Week view
  const weekDays = React.useMemo(() => {
    return getWeekCalendarDays(viewDate, selectedDateString, items);
  }, [viewDate, selectedDateString, items]);

  return (
    <div className="flex-1 w-full h-[calc(100vh-4.5rem)] pl-20 pr-6 pt-2 pb-3 flex items-start gap-4 overflow-hidden select-none animate-in fade-in-50 duration-200">
      {/* Central Calendar Workspace (~75% width) */}
      <section className="clay-surface flex-1 h-full p-5 sm:p-6 flex flex-col gap-4 overflow-hidden">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EDE5D9]/70 shrink-0">
          {/* Left: Icon Badge + Title + Subtitle */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] border border-[#F5C6A3] flex items-center justify-center text-[#F58B35] shadow-[0_2px_8px_rgba(245,139,53,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] shrink-0">
              <CalendarIcon className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#24211F] leading-tight">
                Calendar
              </h2>
              <p className="text-xs text-[#817A72] leading-none mt-0.5">
                All your clips, organised by date
              </p>
            </div>
          </div>

          {/* Right Controls: View Switcher + Month Navigation + Today Button */}
          <div className="flex items-center gap-3">
            {/* 1. View Mode Segment Tabs (Month / Week / Day) */}
            <ClayTabs
              options={VIEW_OPTIONS}
              value={viewMode}
              onChange={setViewMode}
            />

            {/* 2. Month/Year Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                title="Previous period"
                className="clay-icon-btn h-8 w-8 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </button>

              <span className="min-w-[92px] text-center text-xs font-bold text-[#24211F]">
                {monthYearLabel}
              </span>

              <button
                type="button"
                onClick={handleNext}
                title="Next period"
                className="clay-icon-btn h-8 w-8 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </button>
            </div>

            {/* 3. Today Button */}
            <button
              type="button"
              onClick={handleToday}
              className="clay-btn-secondary h-8 px-3.5 text-xs font-bold text-[#24211F] active:scale-95 cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>

        {/* Central Grid Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {viewMode === "month" && (
            <CalendarMonthGrid
              days={monthDays}
              onSelectDate={handleSelectDate}
            />
          )}

          {viewMode === "week" && (
            <CalendarWeekGrid
              days={weekDays}
              onSelectDate={handleSelectDate}
              onPinToggle={onPinToggle}
            />
          )}

          {viewMode === "day" && (
            <CalendarDayGrid
              selectedDateString={selectedDateString}
              items={selectedDateItems}
              canManage={canManage}
              onPinToggle={onPinToggle}
              onAddItem={() => onPasteCapture(selectedDateString)}
            />
          )}
        </div>
      </section>

      {/* Right-Side Today / Selected Date Panel (~25% width) */}
      <CalendarSelectedPanel
        selectedDateString={selectedDateString}
        items={selectedDateItems}
        canManage={canManage}
        onPasteClick={() => onPasteCapture(selectedDateString)}
        onPinToggle={onPinToggle}
        onEdit={setEditingItem}
        onDelete={setDeletingItem}
        onShare={(item) => setShareItemIds([item.id])}
      />

      {/* Shared Modals */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          onItemUpdated={onItemUpdated}
          customUpdateUrl={customUpdateUrl}
        />
      )}

      {deletingItem && (
        <DeleteItemDialog
          item={deletingItem}
          isOpen={Boolean(deletingItem)}
          onClose={() => setDeletingItem(null)}
          onItemDeleted={onItemDeleted}
          customDeleteUrl={customDeleteUrl}
        />
      )}

      {shareItemIds && shareItemIds.length > 0 && (
        <CreateShareModal
          isOpen={true}
          workspaceId={workspace.id}
          preselectedItemIds={shareItemIds}
          onClose={() => setShareItemIds(null)}
          onShareCreated={() => setShareItemIds(null)}
        />
      )}
    </div>
  );
}
