"use client";

import * as React from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Download,
  Play,
  Pause,
  Loader2,
  Bookmark,
  Link2,
  Github,
} from "lucide-react";
import { ClipboardItem } from "@/lib/validation/item";
import { getFileDownloadUrl } from "@/features/clipboard/r2-upload-client";
import { CardActionMenu } from "./card-action-menu";
import { cn } from "@/lib/utils";

export interface CardBaseProps {
  item: ClipboardItem;
  canManage: boolean;
  onPinToggle?: (item: ClipboardItem) => void;
  onEdit?: (item: ClipboardItem) => void;
  onDelete?: (item: ClipboardItem) => void;
  onShare?: (item: ClipboardItem) => void;
}

/**
 * Calculates human friendly relative time (e.g. "3m ago", "1h ago", "2d ago")
 */
export function getRelativeTimeString(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return "recent";
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "recent";
  }
}

/**
 * Format bytes into readable string (e.g. "2.4 MB", "812 KB")
 */
export function formatFileSizeShort(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 1. TEXT CARD
 */
export function BoardTextCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [copied, setCopied] = React.useState(false);
  const timeStr = getRelativeTimeString(item.createdAt);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.content || item.title || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-4 border transition-all duration-200 ease-out flex flex-col justify-between gap-3 min-h-[105px] animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      {/* Title / Content Preview */}
      <div className="space-y-1.5">
        <h4 className="text-[13px] font-semibold text-[#151515] leading-snug line-clamp-2">
          {item.title}
        </h4>
        {item.content && item.content !== item.title && (
          <p className="text-[11.5px] text-[#151515]/75 whitespace-pre-wrap leading-relaxed line-clamp-4 font-normal">
            {item.content}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F5F1E8] text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned item">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Quick copy"
            className="h-6 w-6 rounded-md flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] transition-all cursor-pointer active:scale-90"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
            ) : (
              <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
            )}
          </button>

          {/* 3-Dots Action Menu */}
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

/**
 * 2. CODE CARD
 */
export function BoardCodeCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [copied, setCopied] = React.useState(false);
  const timeStr = getRelativeTimeString(item.createdAt);
  const lang = item.language || "code";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#1C1C23] p-3.5 text-white border transition-all duration-200 ease-out flex flex-col justify-between gap-3 animate-card-enter",
        "shadow-[0_4px_16px_rgba(0,0,0,0.18),0_1px_4px_rgba(0,0,0,0.1)]",
        "hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.32),0_8px_18px_rgba(0,0,0,0.18)] hover:border-white/20",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned ? "border-[#F58B35]/60 ring-1 ring-[#F58B35]/40" : "border-white/10"
      )}
    >
      {/* Header with Title and Language Pill */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h5 className="text-[11px] font-mono font-medium text-gray-300 truncate flex-1">
          {item.title || "Snippet"}
        </h5>
        <span className="shrink-0 rounded-md bg-blue-500/25 text-blue-300 font-mono text-[9px] font-bold px-1.5 py-0.5 border border-blue-400/30">
          {(item.language || "CODE").slice(0, 4).toUpperCase()}
        </span>
      </div>

      {/* Code Text with monospace syntax vibe & dedicated horizontal scroll */}
      <div
        onWheel={(e) => {
          e.stopPropagation();
          const el = e.currentTarget;
          if (el.scrollWidth > el.clientWidth) {
            if (e.shiftKey || Math.abs(e.deltaX) > 0) {
              el.scrollLeft += (e.deltaX || e.deltaY);
            } else if (el.scrollHeight <= el.clientHeight) {
              // Convert standard mouse wheel to horizontal code scroll when no vertical overflow
              el.scrollLeft += e.deltaY;
            }
          }
        }}
        className="font-mono text-[11px] leading-relaxed overflow-x-auto select-text scrollbar-thin max-h-56"
      >
        <pre className="text-gray-200 whitespace-pre font-mono">
          <code>{item.content || "// empty snippet"}</code>
        </pre>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 text-[10.5px] text-gray-400 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9.5px] text-gray-500 uppercase font-semibold">{lang}</span>
          <span>•</span>
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned snippet">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Quick copy code"
            className="h-6 w-6 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-90"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 animate-pop-check" />
            ) : (
              <Copy className="h-3.5 w-3.5 stroke-[1.8]" />
            )}
          </button>

          {/* 3-Dots Action Menu */}
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
    </div>
  );
}

/**
 * 3. LINK CARD
 */
export function BoardLinkCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const timeStr = getRelativeTimeString(item.createdAt);
  const url = item.content || "#";

  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "link";
  }

  const isGitHub = domain.includes("github.com");
  const isYouTube = domain.includes("youtube.com") || domain.includes("youtu.be");

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-3.5 border transition-all duration-200 ease-out flex flex-col gap-2.5 animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-2.5">
        <div className="h-6 w-6 rounded-full bg-[#EAE6DE] flex items-center justify-center shrink-0 text-[#151515] shadow-2xs">
          {isGitHub ? (
            <Github className="h-3.5 w-3.5" />
          ) : isYouTube ? (
            <Play className="h-2.5 w-2.5 fill-current ml-0.5 text-red-600" />
          ) : (
            <Link2 className="h-3.5 w-3.5 text-[#D48B28]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[#151515] truncate">
            {item.title || domain}
          </div>
          <div className="text-[10px] text-[#77736D] truncate">{domain}</div>
        </div>
      </div>

      {/* Short Description */}
      <p className="text-[11.5px] text-[#151515]/75 line-clamp-2 leading-snug">
        {item.title !== domain ? item.title : `Explore ${domain}`}
      </p>

      {/* Visual wave banner placeholder */}
      <div className="h-14 w-full rounded-xl bg-gradient-to-r from-[#FFE0C9] via-[#FFF0D4] to-[#FFE6D9] flex items-center justify-center opacity-85 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]" />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F5F1E8] text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned link">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 rounded-md flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] transition-all cursor-pointer active:scale-90"
            title="Open link in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5 stroke-[1.8]" />
          </a>

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

/**
 * 4. IMAGE CARD
 */
export function BoardImageCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = React.useState(false);
  const timeStr = getRelativeTimeString(item.createdAt);

  React.useEffect(() => {
    let isMounted = true;
    if (item.objectKey && !mediaUrl) {
      setLoadingMedia(true);
      getFileDownloadUrl(item.workspaceId, item.id, false)
        .then((res) => {
          if (isMounted) setMediaUrl(res.url);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingMedia(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.objectKey, item.workspaceId, mediaUrl]);

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-2.5 border transition-all duration-200 ease-out flex flex-col gap-2 animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      {/* Image Preview Container */}
      <div className="relative rounded-xl overflow-hidden bg-[#F3EFE8] min-h-[130px] max-h-52 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
        {loadingMedia ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#F28A32]" />
        ) : mediaUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mediaUrl}
            alt={item.title}
            className="w-full h-auto max-h-52 object-cover rounded-xl transition-transform duration-300 group-hover:scale-102"
            loading="lazy"
          />
        ) : (
          /* Fallback organic artwork banner */
          <div className="w-full h-36 bg-gradient-to-tr from-[#FFC84B] via-[#F28A32] to-[#E84B35] rounded-xl opacity-90 flex items-center justify-center text-white text-xs font-semibold px-3 text-center shadow-inner">
            <span>{item.title}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-1 pt-1 text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned image">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 rounded-md flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] transition-all cursor-pointer active:scale-90"
              title="Open full size image"
            >
              <ExternalLink className="h-3.5 w-3.5 stroke-[1.8]" />
            </a>
          )}

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

/**
 * 5. AUDIO CARD
 */
export function BoardAudioCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timeStr = getRelativeTimeString(item.createdAt);

  const handleTogglePlay = async () => {
    if (!mediaUrl && item.objectKey) {
      try {
        const res = await getFileDownloadUrl(item.workspaceId, item.id, false);
        setMediaUrl(res.url);
      } catch (err) {
        console.error("Audio stream load error:", err);
      }
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // 24 waveform bars with varied heights
  const waveformHeights = [
    30, 48, 62, 85, 42, 72, 95, 62, 82, 52, 68, 92, 78, 48, 82, 100, 72, 58, 42,
    68, 82, 52, 38, 28,
  ];

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-3.5 border transition-all duration-200 ease-out flex flex-col gap-3 animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Audio Playback Controls & Waveform */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTogglePlay}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer active:scale-90",
            isPlaying
              ? "bg-[#E84B35] text-white scale-105 shadow-[0_0_12px_rgba(232,75,53,0.35)]"
              : "bg-[#FFE5E0] text-[#E84B35] hover:scale-105"
          )}
          title={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform Visualization with lively bouncing equalizer effect */}
        <div className="flex-1 flex items-center justify-between gap-[2px] h-7 px-1">
          {waveformHeights.map((h, i) => {
            const danceClass =
              i % 4 === 0
                ? "wave-dance-1"
                : i % 4 === 1
                ? "wave-dance-2"
                : i % 4 === 2
                ? "wave-dance-3"
                : "wave-dance-4";

            return (
              <div
                key={i}
                className={cn(
                  "w-[2.5px] rounded-full transition-all duration-150 origin-bottom",
                  isPlaying
                    ? cn("bg-[#E84B35]", danceClass)
                    : "bg-[#F28A32]/75 group-hover:bg-[#E84B35]"
                )}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Time Display */}
      <div className="text-[10px] text-[#77736D] font-mono text-center tracking-wider">
        {isPlaying ? "0:14 / 2:34" : "0:00 / 2:34"}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F5F1E8] text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned audio">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        {/* 3-Dots Action Menu */}
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

/**
 * 6. VIDEO CARD
 */
export function BoardVideoCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const timeStr = getRelativeTimeString(item.createdAt);

  const handlePlayVideo = async () => {
    if (!mediaUrl && item.objectKey) {
      try {
        const res = await getFileDownloadUrl(item.workspaceId, item.id, false);
        setMediaUrl(res.url);
      } catch (err) {
        console.error("Video load error:", err);
      }
    }
    setIsPlaying(true);
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-2.5 border transition-all duration-200 ease-out flex flex-col gap-2 animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      {/* Video Container */}
      <div className="relative rounded-xl overflow-hidden bg-black/10 min-h-[130px] max-h-52 flex items-center justify-center shadow-inner">
        {isPlaying && mediaUrl ? (
          <video
            controls
            autoPlay
            playsInline
            src={mediaUrl}
            className="w-full h-auto max-h-52 object-cover rounded-xl"
          />
        ) : (
          <div
            onClick={handlePlayVideo}
            className="relative w-full h-36 bg-gradient-to-tr from-[#151515] to-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer flex items-center justify-center group/play"
          >
            {/* Center Play Button with spring hover */}
            <div className="h-10 w-10 rounded-full bg-white/95 text-[#151515] flex items-center justify-center shadow-md group-hover/play:scale-115 active:scale-95 transition-all">
              <Play className="h-4.5 w-4.5 fill-current ml-0.5 text-[#151515]" />
            </div>

            {/* Duration Badge */}
            <span className="absolute bottom-2 right-2.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-white shadow-xs">
              4:21
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-1 pt-1 text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned video">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 rounded-md flex items-center justify-center text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1] transition-all cursor-pointer active:scale-90"
              title="Open video"
            >
              <ExternalLink className="h-3.5 w-3.5 stroke-[1.8]" />
            </a>
          )}

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

/**
 * 7. FILES CARD
 */
export function BoardFileCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
}: CardBaseProps) {
  const [downloading, setDownloading] = React.useState(false);
  const timeStr = getRelativeTimeString(item.createdAt);
  const fileName = item.originalFileName || item.title || "Document.pdf";
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);

    try {
      const { url } = await getFileDownloadUrl(item.workspaceId, item.id, true);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download file:", err);
    } finally {
      setDownloading(false);
    }
  };

  const badgeColor =
    ext === "PDF"
      ? "bg-[#E84B35]"
      : ext === "DOC" || ext === "DOCX"
      ? "bg-[#3B82F6]"
      : ext === "XLS" || ext === "XLSX" || ext === "CSV"
      ? "bg-[#10B981]"
      : ext === "ZIP" || ext === "TAR" || ext === "RAR"
      ? "bg-[#8B5CF6]"
      : "bg-[#77736D]";

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[#FFFEFB] p-3.5 border transition-all duration-200 ease-out flex flex-col justify-between gap-3 animate-card-enter",
        "shadow-[0_2px_8px_rgba(20,15,10,0.04),0_1px_3px_rgba(20,15,10,0.02)]",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(25,18,12,0.08),0_6px_14px_rgba(25,18,12,0.04)] hover:border-[#DDD4C4]",
        "active:scale-[0.99] active:translate-y-0",
        item.isPinned
          ? "border-[#F8D2B0] bg-[#FFFDFC] shadow-[0_2px_10px_rgba(242,138,50,0.08)]"
          : "border-[#EEE7DB]"
      )}
    >
      <div className="space-y-2">
        {/* File Type Pill */}
        <span
          className={cn(
            "inline-block rounded-md px-2 py-0.5 text-[9.5px] font-bold text-white tracking-wider shadow-2xs",
            badgeColor
          )}
        >
          {ext.slice(0, 4)}
        </span>

        {/* File Name */}
        <h4 className="text-[13px] font-semibold text-[#151515] truncate" title={fileName}>
          {fileName}
        </h4>

        {/* File Metadata */}
        <p className="text-[10.5px] text-[#77736D]">
          {formatFileSizeShort(item.sizeBytes)} • {timeStr}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F5F1E8] text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-1.5">
          <span>{timeStr}</span>
          {item.isPinned && (
            <span title="Pinned file">
              <Bookmark className="h-3 w-3 fill-current text-[#F28A32]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Download Action */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="h-6 w-6 rounded-md flex items-center justify-center text-[#151515] hover:text-[#F28A32] hover:bg-[#F0ECE1] transition-all cursor-pointer active:scale-90"
            title="Download file"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F28A32]" />
            ) : (
              <Download className="h-3.5 w-3.5 stroke-[1.8]" />
            )}
          </button>

          {/* 3-Dots Action Menu */}
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
