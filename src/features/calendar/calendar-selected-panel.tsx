"use client";

import * as React from "react";
import {
  ClipboardPaste,
  Copy,
  Check,
  Bookmark,
  ExternalLink,
  Download,
  Play,
  Pause,
  Inbox,
  Loader2,
  Type,
  Code2,
  Link2,
  Image as ImageIcon,
  FileText,
  AudioLines,
  Video,
} from "lucide-react";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";
import { CalendarFilterType } from "./calendar-types";
import { formatSelectedDateDisplay, getSelectedDateHeading } from "./calendar-utils";
import { getRelativeTimeString, formatFileSizeShort } from "@/features/clipboard/board/board-card-renderers";
import { CardActionMenu } from "@/features/clipboard/board/card-action-menu";
import { cn } from "@/lib/utils";

interface CalendarSelectedPanelProps {
  selectedDateString: string;
  items: ClipboardItem[];
  canManage: boolean;
  onPasteClick: () => void;
  onPinToggle: (item: ClipboardItem) => void;
  onEdit: (item: ClipboardItem) => void;
  onDelete: (item: ClipboardItem) => void;
  onShare: (item: ClipboardItem) => void;
}

const FILTER_OPTIONS: { type: CalendarFilterType; label: string }[] = [
  { type: "all", label: "All" },
  { type: "text", label: "Text" },
  { type: "code", label: "Code" },
  { type: "link", label: "Link" },
  { type: "image", label: "Image" },
  { type: "audio", label: "Audio" },
  { type: "video", label: "Video" },
  { type: "file", label: "File" },
];

export function CalendarSelectedPanel({
  selectedDateString,
  items,
  canManage,
  onPasteClick,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CalendarSelectedPanelProps) {
  const [filter, setFilter] = React.useState<CalendarFilterType>("all");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(null);

  const heading = getSelectedDateHeading(selectedDateString);
  const formattedDate = formatSelectedDateDisplay(selectedDateString);

  // Filter items by selected content type
  const filteredItems = React.useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => (item.type || "text") === filter);
  }, [items, filter]);

  const handleCopy = async (e: React.MouseEvent, item: ClipboardItem) => {
    e.stopPropagation();
    try {
      const text = item.content || item.title || item.originalFileName || "";
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const renderItemCard = (item: ClipboardItem) => {
    const isCopied = copiedId === item.id;
    const timeStr = getRelativeTimeString(item.createdAt);
    const itemType = item.type || "text";

    // 1. Text Card
    if (itemType === "text") {
      return (
        <div
          key={item.id}
          className={cn(
            "clay-card p-3.5 space-y-2 select-text",
            item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
          )}
        >
          <div className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-full bg-[#FFE8D6] text-[#A65E26] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Type className="h-3.5 w-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h5 className="text-xs font-bold text-[#24211F] leading-snug">
                {item.title}
              </h5>
              {item.content && item.content !== item.title && (
                <p className="text-[11px] text-[#817A72] line-clamp-3 leading-relaxed">
                  {item.content}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#F5EFE5] text-[10.5px] text-[#AAA197]">
            <span>{timeStr}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleCopy(e, item)}
                title="Copy text"
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onPinToggle(item)}
                title={item.isPinned ? "Unpin item" : "Pin item"}
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                <Bookmark
                  className={cn(
                    "h-3 w-3",
                    item.isPinned && "fill-current text-[#F58B35]"
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
        </div>
      );
    }

    // 2. Code Card
    if (itemType === "code") {
      const lang = item.language || "code";
      return (
        <div
          key={item.id}
          className={cn(
            "clay-card p-3.5 space-y-2 select-text",
            item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-full bg-[#E9DDF6] text-[#6948A4] flex items-center justify-center shrink-0 shadow-2xs">
                <Code2 className="h-3.5 w-3.5 stroke-[2.2]" />
              </div>
              <h5 className="text-xs font-bold text-[#24211F] truncate">
                {item.title}
              </h5>
            </div>
            <span className="font-mono text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              {lang.toUpperCase()}
            </span>
          </div>

          {/* Syntax Code Container */}
          <div className="font-mono text-[11px] leading-relaxed overflow-x-auto select-text scrollbar-thin max-h-40 bg-[#1C1C24] text-gray-200 p-2.5 rounded-xl border border-black/20">
            <pre className="whitespace-pre">
              <code>{item.content || "// empty snippet"}</code>
            </pre>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#F5EFE5] text-[10.5px] text-[#AAA197]">
            <span>{timeStr}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleCopy(e, item)}
                title="Copy code"
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onPinToggle(item)}
                title={item.isPinned ? "Unpin" : "Pin"}
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                <Bookmark
                  className={cn(
                    "h-3 w-3",
                    item.isPinned && "fill-current text-[#F58B35]"
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
        </div>
      );
    }

    // 3. Link Card
    if (itemType === "link") {
      const url = item.content || "#";
      let domain = "link";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}

      return (
        <div
          key={item.id}
          className={cn(
            "clay-card p-3.5 space-y-2 select-text",
            item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-full bg-[#FFF2D4] text-[#9A6D14] flex items-center justify-center shrink-0 shadow-2xs">
              <Link2 className="h-3.5 w-3.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-xs font-bold text-[#24211F] truncate">
                {item.title}
              </h5>
              <p className="text-[10.5px] text-[#817A72] truncate">{domain}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#F5EFE5] text-[10.5px] text-[#AAA197]">
            <span>{timeStr}</span>
            <div className="flex items-center gap-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open link"
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={(e) => handleCopy(e, item)}
                title="Copy URL"
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
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
        </div>
      );
    }

    // 4. Image Card
    if (itemType === "image") {
      return (
        <div
          key={item.id}
          className={cn(
            "clay-card p-3.5 space-y-2 select-text",
            item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[#FFE5E2] text-[#B73D30] flex items-center justify-center shrink-0 shadow-2xs">
              <ImageIcon className="h-3.5 w-3.5 stroke-[2.2]" />
            </div>
            <h5 className="text-xs font-bold text-[#24211F] truncate flex-1">
              {item.title || item.originalFileName || "Image"}
            </h5>
          </div>

          {/* Visual Artwork Thumbnail */}
          <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gradient-to-tr from-[#FFD36C] via-[#F58B35] to-[#EE624E] shadow-2xs flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-white/80 stroke-[1.8]" />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#F5EFE5] text-[10.5px] text-[#AAA197]">
            <span>{timeStr}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleCopy(e, item)}
                title="Copy file info"
                className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
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
        </div>
      );
    }

    // 5. Audio, Video, File Cards
    const isAudio = itemType === "audio";
    const isVideo = itemType === "video";

    return (
      <div
        key={item.id}
        className={cn(
          "clay-card p-3.5 space-y-2 select-text",
          item.isPinned ? "border-[#F58B35]/40 bg-[#FFFDFC]" : "bg-white"
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center shrink-0 shadow-2xs",
              isAudio
                ? "bg-[#FCE8EB] text-[#A43B4E]"
                : isVideo
                ? "bg-[#FEE4E2] text-[#B92F24]"
                : "bg-[#FEF0D4] text-[#986415]"
            )}
          >
            {isAudio ? (
              <AudioLines className="h-3.5 w-3.5 stroke-[2.2]" />
            ) : isVideo ? (
              <Video className="h-3.5 w-3.5 stroke-[2.2]" />
            ) : (
              <FileText className="h-3.5 w-3.5 stroke-[2.2]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h5 className="text-xs font-bold text-[#24211F] truncate">
              {item.title || item.originalFileName || (isAudio ? "Audio Track" : isVideo ? "Video Clip" : "Attachment")}
            </h5>
            {item.sizeBytes && (
              <p className="text-[10.5px] text-[#817A72]">
                {formatFileSizeShort(item.sizeBytes)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-[#F5EFE5] text-[10.5px] text-[#AAA197]">
          <span>{timeStr}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => handleCopy(e, item)}
              title="Copy"
              className="clay-icon-btn h-6 w-6 flex items-center justify-center text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-emerald-600 animate-pop-check" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
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
      </div>
    );
  };

  return (
    <aside className="clay-surface w-[300px] sm:w-[320px] lg:w-[350px] shrink-0 h-full p-4 sm:p-5 flex flex-col gap-3 overflow-hidden select-none animate-in fade-in-50 duration-200">
      {/* 1. Header with dynamic date and Tangerine Paste button */}
      <div className="flex items-start justify-between pb-3 border-b border-[#EDE5D9]/70 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-[#24211F] leading-tight">
            {heading}
          </h3>
          <p className="text-[11px] font-medium text-[#817A72] mt-0.5">
            {formattedDate}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={onPasteClick}
            title="Paste to this date (Ctrl+V)"
            className="clay-btn-primary flex items-center gap-1.5 h-8 px-3.5 text-xs font-bold active:scale-95 cursor-pointer"
          >
            <ClipboardPaste className="h-3.5 w-3.5 stroke-[2.2]" />
            <span>Paste</span>
          </button>
        )}
      </div>

      {/* 2. Total items & Type Filter Pills */}
      <div className="space-y-2 shrink-0">
        <div className="text-xs font-bold text-[#817A72]">
          {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => {
            const isSelected = filter === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setFilter(opt.type)}
                className={cn(
                  "h-6 px-2.5 rounded-full text-[11px] font-bold transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_1px_3px_rgba(245,139,53,0.15)] scale-105"
                    : "bg-[#F5EFE5] text-[#817A72] hover:text-[#24211F] hover:bg-[#EAE4D8] border border-transparent"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Vertically Scrollable List of Cards */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-thin select-text">
        {filteredItems.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-dashed border-[#DDD5C7] bg-[#FAF7F0]/40">
            <Inbox className="h-7 w-7 mb-2 opacity-40 text-[#817A72]" />
            <h5 className="text-xs font-bold text-[#24211F]">No items for this date</h5>
            <p className="text-[11px] text-[#817A72] mt-1">
              Press Ctrl+V to paste new content directly onto {formattedDate}.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => renderItemCard(item))
        )}
      </div>
    </aside>
  );
}
