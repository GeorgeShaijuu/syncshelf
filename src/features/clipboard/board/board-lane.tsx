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
  Inbox,
  Check,
} from "lucide-react";
import {
  BoardTextCard,
  BoardCodeCard,
  BoardLinkCard,
  BoardImageCard,
  BoardAudioCard,
  BoardVideoCard,
  BoardFileCard,
} from "./board-card-renderers";
import { LaneActionMenu } from "./lane-action-menu";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";
import { cn } from "@/lib/utils";

export interface LaneDefinition {
  id: ClipboardItemType;
  title: string;
  badgeContent: React.ReactNode;
  badgeStyle: string;
}

export const BOARD_LANES: LaneDefinition[] = [
  {
    id: "text",
    title: "Text",
    badgeContent: <Type className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFE8D6] text-[#A65E26]",
  },
  {
    id: "code",
    title: "Codes",
    badgeContent: <Code2 className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#EEE4F5] text-[#8A56AC]",
  },
  {
    id: "link",
    title: "Links",
    badgeContent: <Link2 className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFF3D6] text-[#D48B28]",
  },
  {
    id: "image",
    title: "Images",
    badgeContent: <ImageIcon className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFE2D9] text-[#E84B35]",
  },
  {
    id: "audio",
    title: "Audio",
    badgeContent: <AudioLines className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFE5E0] text-[#E84B35]",
  },
  {
    id: "video",
    title: "Video",
    badgeContent: <Video className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFE6D9] text-[#F28A32]",
  },
  {
    id: "file",
    title: "Files",
    badgeContent: <FileText className="h-3.5 w-3.5 stroke-[2.2]" />,
    badgeStyle: "bg-[#FFF4D6] text-[#C4881A]",
  },
];

interface BoardLaneProps {
  lane: LaneDefinition;
  items: ClipboardItem[];
  canManage: boolean;
  isSelectMode: boolean;
  selectedItemIds: Set<string>;
  isActiveLane?: boolean;
  onSelectLane?: (laneId: ClipboardItemType) => void;
  onToggleSelectItem: (id: string) => void;
  onPinToggle: (item: ClipboardItem) => void;
  onEdit: (item: ClipboardItem) => void;
  onDelete: (item: ClipboardItem) => void;
  onShare?: (item: ClipboardItem) => void;
  onAddItem?: (laneId: string) => void;
  onSelectLaneItems?: (itemIds: string[]) => void;
  onBatchPin?: (items: ClipboardItem[]) => void;
  onMaximiseLane?: (laneId: ClipboardItemType) => void;
}

export function BoardLane({
  lane,
  items,
  canManage,
  isSelectMode,
  selectedItemIds,
  isActiveLane = false,
  onSelectLane,
  onToggleSelectItem,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
  onAddItem,
  onSelectLaneItems,
  onBatchPin,
  onMaximiseLane,
}: BoardLaneProps) {
  const renderCard = (item: ClipboardItem) => {
    switch (lane.id) {
      case "code":
        return (
          <BoardCodeCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      case "link":
        return (
          <BoardLinkCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      case "image":
        return (
          <BoardImageCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      case "audio":
        return (
          <BoardAudioCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      case "video":
        return (
          <BoardVideoCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      case "file":
        return (
          <BoardFileCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
      default:
        return (
          <BoardTextCard
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        );
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onSelectLane) onSelectLane(lane.id);
      }}
      className={cn(
        "board-lane-container flex flex-col w-[280px] sm:w-[305px] md:w-[325px] lg:w-[340px] xl:w-[355px] shrink-0 h-full rounded-3xl bg-[#F2ECE3]/80 border p-3 select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.025),0_1px_2px_rgba(255,255,255,0.7)] transition-all cursor-default",
        isActiveLane
          ? "border-[#F28A32]/60 ring-2 ring-[#F28A32]/25 bg-[#EEE6DC]"
          : "border-[#E7E0D2]"
      )}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between px-1.5 py-1.5 mb-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Circular Content Icon Badge */}
          <div
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs",
              lane.badgeStyle
            )}
          >
            {lane.badgeContent}
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#151515] leading-none">
              {lane.title}
            </h3>
            <span className="text-[10.5px] text-[#77736D] leading-none mt-0.5 inline-block">
              {items.length} {items.length === 1 ? "item" : "items"}
              {isActiveLane && " • Active"}
            </span>
          </div>
        </div>

        {/* Lane 3-Dots Action Menu */}
        <LaneActionMenu
          lane={lane}
          items={items}
          canManage={canManage}
          onAddItem={onAddItem}
          onSelectLaneItems={onSelectLaneItems}
          onBatchPin={onBatchPin}
          onMaximiseLane={onMaximiseLane}
        />
      </div>

      {/* Lane Cards Scrollable Area */}
      <div
        onWheel={(e) => {
          // If this lane is selected or user holds Shift/Ctrl/Alt, scroll cards vertically
          if (isActiveLane || e.shiftKey || e.ctrlKey || e.altKey) {
            e.stopPropagation();
          }
        }}
        className="lane-cards-scroll flex-1 overflow-y-auto space-y-3 pr-0.5 pb-2 scrollbar-thin scroll-smooth"
      >
        {items.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center p-4 text-center rounded-2xl border border-dashed border-[#DDD6C8] text-[#77736D]/70 bg-[#FFFEFB]/40">
            <Inbox className="h-6 w-6 mb-2 opacity-40 text-[#77736D]" />
            <p className="text-xs font-semibold text-[#151515]/70">Empty lane</p>
            <p className="text-[10.5px] text-[#77736D] mt-1 max-w-[180px]">
              Paste or drop {lane.title.toLowerCase()} items onto the board
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedItemIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={
                  isSelectMode ? () => onToggleSelectItem(item.id) : undefined
                }
                className={cn(
                  "relative transition-all",
                  isSelectMode && "cursor-pointer"
                )}
              >
                {/* Select Mode Checkbox Overlay */}
                {isSelectMode && (
                  <div className="absolute top-2.5 left-2.5 z-20">
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md border flex items-center justify-center shadow-xs transition-colors",
                        isSelected
                          ? "bg-[#F28A32] border-[#F28A32] text-white"
                          : "bg-white/90 border-[#D2CCC0] text-transparent hover:border-[#F28A32]"
                      )}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "transition-transform",
                    isSelectMode && isSelected && "scale-[0.98] ring-2 ring-[#F28A32] rounded-2xl"
                  )}
                >
                  {renderCard(item)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
