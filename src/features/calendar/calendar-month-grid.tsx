"use client";

import * as React from "react";
import { CalendarDayInfo } from "./calendar-types";
import { CalendarDateCell } from "./calendar-date-cell";

interface CalendarMonthGridProps {
  days: CalendarDayInfo[];
  onSelectDate: (dateString: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthGrid({ days, onSelectDate }: CalendarMonthGridProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 7 Column Day Name Headers */}
      <div className="grid grid-cols-7 gap-2 pb-2 text-center select-none shrink-0 border-b border-[#EDE5D9]/60">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-xs font-semibold text-[#817A72] tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid of Date Cells */}
      <div className="grid grid-cols-7 gap-2 pt-2 flex-1 auto-rows-fr overflow-y-auto pr-0.5 scrollbar-thin">
        {days.map((day) => (
          <CalendarDateCell
            key={day.dateString}
            day={day}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
