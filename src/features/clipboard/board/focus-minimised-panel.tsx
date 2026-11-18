"use client";

import * as React from "react";
import { ChevronRight, Link2, Image as ImageIcon } from "lucide-react";
import { BOARD_LANES, LaneDefinition } from "./board-lane";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";
import { cn } from "@/lib/utils";

interface FocusMinimisedPanelProps {
  currentLaneId: ClipboardItemType;
  laneItemMap: Map<ClipboardItemType, ClipboardItem[]>;
  onSelectLane: (laneId: ClipboardItemType) => void;
}

export function FocusMinimisedPanel({
  currentLaneId,
  laneItemMap,
  onSelectLane,
}: FocusMinimisedPanelProps) {
  // All 6 lanes except the currently maximised lane
  const otherLanes = BOARD_LANES.filter((l) => l.id !== currentLaneId);

  const renderCompactPreview = (lane: LaneDefinition, firstItem?: ClipboardItem) => {
    switch (lane.id) {
      case "code":
        return (
          <div className="h-8 w-14 rounded-lg bg-[#1C1C24] p-1 flex flex-col justify-between overflow-hidden shadow-2xs border border-black/30">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[7px] text-gray-400">code</span>
              <span className="rounded bg-blue-500/30 px-1 py-0.2 font-mono text-[6.5px] font-bold text-blue-300">
                {firstItem?.language?.slice(0, 3).toUpperCase() || "TS"}
              </span>
            </div>
            <div className="h-1.5 w-10 rounded bg-gray-600/50" />
          </div>
        );

      case "link":
        return (
          <div className="h-8 w-14 rounded-lg bg-gradient-to-r from-[#FFE0C9] via-[#FFF3D6] to-[#FFE6D9] p-1 flex items-center justify-center shadow-2xs border border-[#E7E0D2]">
            <div className="h-4 w-7 rounded-full bg-[#E84B35]/20 flex items-center justify-center">
              <Link2 className="h-2.5 w-2.5 stroke-[2.4] text-[#D48B28]" />
            </div>
          </div>
        );

      case "image":
        return (
          <div className="h-8 w-14 rounded-lg overflow-hidden bg-gradient-to-tr from-[#FFC84B] via-[#F28A32] to-[#E84B35] shadow-2xs flex items-center justify-center">
            <ImageIcon className="h-3.5 w-3.5 text-white/95 stroke-[2]" />
          </div>
        );

      case "audio":
        return (
          <div className="h-8 w-14 rounded-lg bg-[#FFF2ED] px-1 flex items-center justify-center gap-[2px] shadow-2xs border border-[#FFE0D9]">
            {[35, 70, 100, 50, 85, 40].map((h, i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-[#E84B35]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        );

      case "video":
        return (
          <div className="relative h-8 w-14 rounded-lg overflow-hidden bg-[#24242A] shadow-2xs flex items-center justify-center border border-black/20">
            <div className="h-3.5 w-3.5 rounded-full bg-white/90 flex items-center justify-center shadow-2xs">
              <div className="ml-0.5 h-0 w-0 border-y-[2.5px] border-y-transparent border-l-[4px] border-l-[#151515]" />
            </div>
          </div>
        );

      case "file":
        return (
          <div className="h-8 w-14 rounded-lg bg-[#FFF7E8] p-1 flex items-center justify-center shadow-2xs border border-[#F5E5C9]">
            <span className="rounded bg-[#E84B35] px-1.5 py-0.5 font-mono text-[8px] font-bold text-white tracking-wider shadow-2xs">
              {firstItem?.originalFileName?.split(".").pop()?.toUpperCase().slice(0, 3) || "PDF"}
            </span>
          </div>
        );

      default:
        return (
          <div className="h-8 w-14 rounded-lg bg-[#FAF7F0] p-1 flex flex-col justify-center gap-0.5 border border-[#E7E0D2]">
            <div className="h-1 w-8 rounded bg-[#151515]/30" />
            <div className="h-1 w-6 rounded bg-[#151515]/20" />
          </div>
        );
    }
  };

  return (
    <aside className="clay-surface w-[270px] sm:w-[290px] lg:w-[320px] shrink-0 h-full p-3 sm:p-4 flex flex-col gap-2.5 overflow-y-auto scrollbar-thin select-none animate-in fade-in-50 duration-200">
      {otherLanes.map((lane) => {
        const laneItems = laneItemMap.get(lane.id) || [];
        const firstItem = laneItems[0];

        return (
          <div
            key={lane.id}
            onClick={() => onSelectLane(lane.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectLane(lane.id);
              }
            }}
            className="group relative rounded-2xl bg-[#FFFEFA] border border-[#EDE5D9] p-3 shadow-[0_2px_8px_rgba(36,33,31,0.03),0_1px_2px_rgba(36,33,31,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:border-[#DFD5C5] hover:shadow-[0_8px_20px_rgba(36,33,31,0.08),0_2px_6px_rgba(36,33,31,0.04)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-between gap-3"
          >
            {/* Left: Badge + Title + Count */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform",
                  lane.badgeStyle
                )}
              >
                {lane.badgeContent}
              </div>

              <div className="min-w-0 truncate">
                <h4 className="text-xs font-bold text-[#24211F] leading-snug group-hover:text-[#F58B35] transition-colors truncate">
                  {lane.title}
                </h4>
                <p className="text-[10.5px] text-[#817A72] leading-none mt-0.5">
                  {laneItems.length} {laneItems.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>

            {/* Right: First Item Compact Preview + Chevron */}
            <div className="flex items-center gap-2 shrink-0">
              {renderCompactPreview(lane, firstItem)}
              <ChevronRight className="h-4 w-4 text-[#AAA197] group-hover:text-[#24211F] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        );
      })}
    </aside>
  );
}
