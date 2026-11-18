"use client";

import * as React from "react";
import {
  Type,
  Code2,
  Link2,
  Image as ImageIcon,
  AudioLines,
  Video,
  FileText,
} from "lucide-react";
import { CalendarDayInfo } from "./calendar-types";
import { cn } from "@/lib/utils";

interface CalendarDateCellProps {
  day: CalendarDayInfo;
  onSelectDate: (dateString: string) => void;
}

export function CalendarDateCell({ day, onSelectDate }: CalendarDateCellProps) {
  const {
    dayNumber,
    dateString,
    isCurrentMonth,
    isToday,
    isSelected,
    countsByType,
  } = day;

  // Active types that have at least 1 item
  const activeTypes: {
    type: string;
    count: number;
    icon: React.ReactNode;
    pillClass: string;
  }[] = [
    {
      type: "text",
      count: countsByType.text,
      icon: <Type className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FFE8D6] text-[#A65E26] border-[#FCD5B5]",
    },
    {
      type: "code",
      count: countsByType.code,
      icon: <Code2 className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#E9DDF6] text-[#6948A4] border-[#D5C2EC]",
    },
    {
      type: "link",
      count: countsByType.link,
      icon: <Link2 className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FFF2D4] text-[#9A6D14] border-[#FDE3A8]",
    },
    {
      type: "image",
      count: countsByType.image,
      icon: <ImageIcon className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FFE5E2] text-[#B73D30] border-[#F9CBC6]",
    },
    {
      type: "audio",
      count: countsByType.audio,
      icon: <AudioLines className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FCE8EB] text-[#A43B4E] border-[#F8C8D0]",
    },
    {
      type: "video",
      count: countsByType.video,
      icon: <Video className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FEE4E2] text-[#B92F24] border-[#F9C3BE]",
    },
    {
      type: "file",
      count: countsByType.file,
      icon: <FileText className="h-3 w-3 stroke-[2.2]" />,
      pillClass: "bg-[#FEF0D4] text-[#986415] border-[#F9DC9F]",
    },
  ].filter((t) => t.count > 0);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectDate(dateString)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectDate(dateString);
        }
      }}
      className={cn(
        "group relative min-h-[92px] p-2 rounded-2xl border transition-all duration-150 select-none cursor-pointer flex flex-col justify-between",
        isSelected
          ? "clay-cell-selected z-10 scale-[1.01]"
          : isCurrentMonth
          ? "bg-[#FFFEFA] border-[#EDE5D9] hover:border-[#DFD5C5] hover:shadow-[0_4px_12px_rgba(36,33,31,0.04)] hover:-translate-y-0.5 active:translate-y-0"
          : "bg-[#FAF7F0]/60 border-[#EDE5D9]/50 text-[#AAA197] hover:bg-[#FAF7F0]"
      )}
    >
      {/* Top Header: Date Number */}
      <div className="flex items-center justify-between">
        {isSelected ? (
          <span className="h-5 px-1.5 rounded-full bg-gradient-to-b from-[#F99849] to-[#F58B35] text-white font-bold text-xs flex items-center justify-center shadow-[0_2px_4px_rgba(245,139,53,0.3)]">
            {dayNumber}
          </span>
        ) : isToday ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-[#F58B35]">{dayNumber}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#F58B35]" />
          </div>
        ) : (
          <span
            className={cn(
              "text-xs font-semibold",
              isCurrentMonth ? "text-[#24211F]" : "text-[#AAA197]"
            )}
          >
            {dayNumber}
          </span>
        )}
      </div>

      {/* Middle/Bottom: Content Type Badges with Counts */}
      <div className="flex flex-wrap gap-1 mt-1.5 items-end justify-start">
        {activeTypes.map(({ type, count, icon, pillClass }) => (
          <span
            key={type}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold border transition-transform duration-100",
              "shadow-[0_1px_2px_rgba(36,33,31,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
              pillClass
            )}
            title={`${count} ${type} ${count === 1 ? "item" : "items"}`}
          >
            <span className="flex items-center justify-center shrink-0">{icon}</span>
            <span className="font-semibold text-[9.5px] leading-none opacity-95">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
