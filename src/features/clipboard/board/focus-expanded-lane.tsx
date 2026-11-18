"use client";

import * as React from "react";
import {
  LayoutGrid,
  Plus,
  ClipboardPaste,
  Copy,
  Check,
  Bookmark,
  ExternalLink,
  Download,
  Play,
  Pause,
  Loader2,
  Inbox,
  Link2,
  Github,
} from "lucide-react";
import { LaneDefinition } from "./board-lane";
import { CardActionMenu } from "./card-action-menu";
import { LaneActionMenu } from "./lane-action-menu";
import { ClipboardItem } from "@/lib/validation/item";
import { getFileDownloadUrl } from "@/features/clipboard/r2-upload-client";
import { getRelativeTimeString, formatFileSizeShort } from "./board-card-renderers";
import { cn } from "@/lib/utils";

interface FocusExpandedLaneProps {
  lane: LaneDefinition;
  items: ClipboardItem[];
  canManage: boolean;
  onRestoreBoard: () => void;
  onAddItem: (laneId: string) => void;
  onPasteToLane: (laneId: string) => void;
  onPinToggle: (item: ClipboardItem) => void;
  onEdit: (item: ClipboardItem) => void;
  onDelete: (item: ClipboardItem) => void;
  onShare: (item: ClipboardItem) => void;
}

export function FocusExpandedLane({
  lane,
  items,
  canManage,
  onRestoreBoard,
  onAddItem,
  onPasteToLane,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: FocusExpandedLaneProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent, item: ClipboardItem) => {
    e.stopPropagation();
    try {
      const textToCopy = item.content || item.title || item.originalFileName || "";
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const renderExpandedCard = (item: ClipboardItem) => {
    const isCopied = copiedId === item.id;
    const timeStr = getRelativeTimeString(item.createdAt);

    // 1. Text item in expanded row (matches reference image bottom panel)
    if (lane.id === "text") {
      return (
        <div
          key={item.id}
          className={cn(
            "group relative rounded-2xl bg-[#FFFEFB] border p-4 shadow-[0_2px_8px_rgba(20,15,10,0.03),0_1px_2px_rgba(20,15,10,0.02)] hover:border-[#DDD4C4] hover:shadow-[0_8px_20px_rgba(25,18,12,0.06),0_2px_6px_rgba(25,18,12,0.03)] transition-all duration-200 flex items-start justify-between gap-4",
            item.isPinned ? "border-[#F8D2B0] bg-[#FFFDFC]" : "border-[#E7E0D2]"
          )}
        >
          {/* Left: Accent Bar + Title + Preview */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "w-1 h-6 rounded-full shrink-0 mt-0.5",
                item.isPinned ? "bg-[#F28A32]" : "bg-[#F28A32]/70 group-hover:bg-[#F28A32]"
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h4 className="text-sm font-semibold text-[#151515] leading-snug">
                {item.title}
              </h4>
              {item.content && item.content !== item.title && (
                <p className="text-xs text-[#77736D] leading-relaxed line-clamp-2">
                  {item.content}
                </p>
              )}
            </div>
          </div>

          {/* Right: Timestamp + Copy + Bookmark + 3-Dots */}
          <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
            <span className="text-xs text-[#77736D] font-medium">{timeStr}</span>

            <button
              type="button"
              onClick={(e) => handleCopy(e, item)}
              title="Quick copy"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
              ) : (
                <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onPinToggle(item)}
              title={item.isPinned ? "Unpin item" : "Pin to top"}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
            >
              <Bookmark
                className={cn(
                  "h-3.5 w-3.5 stroke-[1.8]",
                  item.isPinned ? "fill-current text-[#F28A32]" : ""
                )}
              />
            </button>

            <CardActionMenu
              item={item}
              canManage={canManage}
              onPinToggle={onPinToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onShare={onShare}
            />
          </div>
        </div>
      );
    }

    // 2. Code item in expanded row
    if (lane.id === "code") {
      const lang = item.language?.toUpperCase() || "CODE";
      return (
        <div
          key={item.id}
          className={cn(
            "group relative rounded-2xl bg-[#1C1C24] text-white border p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:border-white/20 hover:shadow-[0_12px_28px_rgba(0,0,0,0.25)] transition-all duration-200 flex flex-col gap-3",
            item.isPinned ? "border-[#F28A32]/60 ring-1 ring-[#F28A32]/40" : "border-white/10"
          )}
        >
          {/* Header with Title and Language Pill */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-blue-400/30">
                {lang}
              </span>
              <h4 className="text-xs font-semibold text-gray-200 truncate">{item.title}</h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{timeStr}</span>

              <button
                type="button"
                onClick={(e) => handleCopy(e, item)}
                title="Copy code"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 animate-pop-check" />
                ) : (
                  <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onPinToggle(item)}
                title={item.isPinned ? "Unpin code" : "Pin code"}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              >
                <Bookmark
                  className={cn(
                    "h-3.5 w-3.5",
                    item.isPinned ? "fill-current text-[#F28A32]" : ""
                  )}
                />
              </button>

              <CardActionMenu
                item={item}
                canManage={canManage}
                onPinToggle={onPinToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
                variant="dark"
              />
            </div>
          </div>

          {/* Syntax Code Container with horizontal scroll */}
          <div
            onWheel={(e) => {
              e.stopPropagation();
              const el = e.currentTarget;
              if (el.scrollWidth > el.clientWidth) {
                el.scrollLeft += e.deltaY;
              }
            }}
            className="font-mono text-[11px] leading-relaxed overflow-x-auto select-text scrollbar-thin max-h-60 bg-black/30 rounded-xl p-3 border border-white/5"
          >
            <pre className="text-gray-200 whitespace-pre">
              <code>{item.content || "// empty snippet"}</code>
            </pre>
          </div>
        </div>
      );
    }

    // 3. Link item in expanded row
    if (lane.id === "link") {
      const url = item.content || "#";
      let domain = "link";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}

      const isGitHub = domain.includes("github.com");
      const isYouTube = domain.includes("youtube.com") || domain.includes("youtu.be");

      return (
        <div
          key={item.id}
          className={cn(
            "group relative rounded-2xl bg-[#FFFEFB] border p-4 shadow-[0_2px_8px_rgba(20,15,10,0.03)] hover:border-[#DDD4C4] hover:shadow-[0_8px_20px_rgba(25,18,12,0.06)] transition-all flex items-center justify-between gap-4",
            item.isPinned ? "border-[#F8D2B0] bg-[#FFFDFC]" : "border-[#E7E0D2]"
          )}
        >
          {/* Favicon + Title + URL */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-full bg-[#EAE6DE] flex items-center justify-center shrink-0 shadow-2xs text-[#151515]">
              {isGitHub ? (
                <Github className="h-4 w-4" />
              ) : isYouTube ? (
                <Play className="h-3 w-3 fill-current ml-0.5 text-red-600" />
              ) : (
                <Link2 className="h-4 w-4 text-[#D48B28]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-[#151515] truncate">{item.title}</h4>
              <p className="text-xs text-[#77736D] truncate mt-0.5">{url}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#77736D] font-medium mr-1">{timeStr}</span>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
              title="Visit link"
            >
              <ExternalLink className="h-3.5 w-3.5 stroke-[1.8]" />
            </a>

            <button
              type="button"
              onClick={(e) => handleCopy(e, item)}
              title="Copy URL"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
              ) : (
                <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onPinToggle(item)}
              title={item.isPinned ? "Unpin link" : "Pin link"}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
            >
              <Bookmark
                className={cn(
                  "h-3.5 w-3.5",
                  item.isPinned ? "fill-current text-[#F28A32]" : ""
                )}
              />
            </button>

            <CardActionMenu
              item={item}
              canManage={canManage}
              onPinToggle={onPinToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onShare={onShare}
            />
          </div>
        </div>
      );
    }

    // 4. Default for other types (Images, Audio, Video, Files)
    return (
      <div
        key={item.id}
        className={cn(
          "group relative rounded-2xl bg-[#FFFEFB] border p-4 shadow-[0_2px_8px_rgba(20,15,10,0.03)] hover:border-[#DDD4C4] hover:shadow-[0_8px_20px_rgba(25,18,12,0.06)] transition-all flex items-center justify-between gap-4",
          item.isPinned ? "border-[#F8D2B0] bg-[#FFFDFC]" : "border-[#E7E0D2]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-full bg-[#FFE8D6] flex items-center justify-center shrink-0 text-[#A65E26] shadow-2xs font-bold text-xs">
            {lane.badgeContent}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[#151515] truncate">
              {item.title || item.originalFileName || "Untitled item"}
            </h4>
            <p className="text-xs text-[#77736D] mt-0.5">
              {item.sizeBytes ? `${formatFileSizeShort(item.sizeBytes)} • ` : ""}
              {timeStr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => handleCopy(e, item)}
            title="Copy content"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
            ) : (
              <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onPinToggle(item)}
            title={item.isPinned ? "Unpin item" : "Pin item"}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] active:scale-90 transition-all cursor-pointer"
          >
            <Bookmark
              className={cn(
                "h-3.5 w-3.5",
                item.isPinned ? "fill-current text-[#F28A32]" : ""
              )}
            />
          </button>

          <CardActionMenu
            item={item}
            canManage={canManage}
            onPinToggle={onPinToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="clay-surface flex-1 h-full p-5 sm:p-6 flex flex-col gap-4 overflow-hidden select-none animate-in fade-in-50 duration-200">
      {/* 1. Top Header Row (Matches reference image) */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EDE5D9]/70 shrink-0">
        {/* Left: "All Lanes" button + Lane Icon + Lane Name + Count */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRestoreBoard}
            title="Restore full board mode (Esc)"
            className="clay-btn-secondary h-8 px-3.5 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <LayoutGrid className="h-3.5 w-3.5 stroke-[2]" />
            <span>All Lanes</span>
          </button>

          {/* Circular Badge */}
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-xs",
              lane.badgeStyle
            )}
          >
            {lane.badgeContent}
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#24211F] leading-none">
              {lane.title}
            </h2>
            <p className="text-xs text-[#817A72] leading-none mt-1">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        {/* Right: + Add Button + Paste Button + 3-Dots Menu */}
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => onAddItem(lane.id)}
              className="clay-btn-primary h-8 px-4 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Add {lane.title}</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => onPasteToLane(lane.id)}
              className="clay-btn-secondary h-8 px-3.5 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Paste clipboard content here (Ctrl+V)"
            >
              <ClipboardPaste className="h-3.5 w-3.5 text-[#817A72] stroke-[2]" />
              <span>Paste</span>
            </button>
          )}

          {/* 3-Dots Action Menu */}
          <LaneActionMenu
            lane={lane}
            items={items}
            canManage={canManage}
            isMaximised={true}
            onAddItem={onAddItem}
            onRestoreBoard={onRestoreBoard}
          />
        </div>
      </div>

      {/* 2. Vertically Scrollable Content Rows */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pb-4 scrollbar-thin select-text">
        {items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-[#DDD6C8] bg-white/40">
            <Inbox className="h-8 w-8 mb-2 opacity-40 text-[#77736D]" />
            <h3 className="text-sm font-semibold text-[#151515]">No {lane.title.toLowerCase()} items yet</h3>
            <p className="text-xs text-[#77736D] mt-1 max-w-xs">
              Click &quot;Add {lane.title}&quot; or press Ctrl+V to paste content directly into this focused lane.
            </p>
          </div>
        ) : (
          items.map((item) => renderExpandedCard(item))
        )}
      </div>
    </div>
  );
}
