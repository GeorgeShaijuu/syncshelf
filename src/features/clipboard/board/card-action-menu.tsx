"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Bookmark,
  Copy,
  Check,
  Edit3,
  Share2,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { ClipboardItem } from "@/lib/validation/item";
import { getFileDownloadUrl } from "@/features/clipboard/r2-upload-client";
import { cn } from "@/lib/utils";

interface CardActionMenuProps {
  item: ClipboardItem;
  canManage: boolean;
  onPinToggle?: (item: ClipboardItem) => void;
  onEdit?: (item: ClipboardItem) => void;
  onDelete?: (item: ClipboardItem) => void;
  onShare?: (item: ClipboardItem) => void;
  align?: "left" | "right";
  variant?: "light" | "dark";
}

export function CardActionMenu({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
  onShare,
  align = "right",
  variant = "light",
}: CardActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Close on outside click or Escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      let textToCopy = item.content || item.title || "";
      if (item.type === "file" && item.originalFileName) {
        textToCopy = item.originalFileName;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 700);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onPinToggle) {
      onPinToggle(item);
    }
    setIsOpen(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onEdit) {
      onEdit(item);
    }
    setIsOpen(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShare) {
      onShare(item);
    }
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(item);
    }
    setIsOpen(false);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!item.objectKey || downloading) return;
    setDownloading(true);

    try {
      const { url } = await getFileDownloadUrl(item.workspaceId, item.id, true);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.originalFileName || item.title || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const isMediaOrFile = Boolean(
    item.objectKey ||
    item.type === "file" ||
    item.type === "image" ||
    item.type === "audio" ||
    item.type === "video"
  );

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Item options"
        aria-expanded={isOpen}
        title="More actions"
        className={cn(
          "h-6 w-6 rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-90",
          variant === "dark"
            ? "text-gray-400 hover:text-white hover:bg-white/10"
            : "text-[#77736D] hover:text-[#151515] hover:bg-[#F0ECE1]",
          isOpen && (variant === "dark" ? "bg-white/15 text-white" : "bg-[#EAE4D8] text-[#151515]")
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5 stroke-[2]" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className={cn(
            "absolute bottom-full mb-1.5 z-50 min-w-[175px] rounded-xl bg-[#FFFEFB] border border-[#E8E2D6] p-1.5 select-none shadow-[0_12px_32px_rgba(20,15,10,0.14),0_4px_10px_rgba(20,15,10,0.06)] animate-pop-in text-[#151515]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* 1. Quick Copy */}
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 animate-pop-check" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
              )}
              {copied ? "Copied!" : item.type === "link" ? "Copy URL" : "Copy Content"}
            </span>
            <span className="text-[10px] text-[#A09B92]">⌘C</span>
          </button>

          {/* 2. Pin / Bookmark Toggle */}
          <button
            type="button"
            role="menuitem"
            onClick={handlePin}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <Bookmark
                className={cn(
                  "h-3.5 w-3.5",
                  item.isPinned
                    ? "fill-current text-[#F28A32]"
                    : "text-[#77736D] group-hover:text-[#151515]"
                )}
              />
              {item.isPinned ? "Unpin item" : "Pin to top"}
            </span>
          </button>

          {/* 3. Share link */}
          {onShare && (
            <button
              type="button"
              role="menuitem"
              onClick={handleShare}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Share2 className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                Share link
              </span>
            </button>
          )}

          {/* 4. Open External Link (if link type) */}
          {item.type === "link" && item.content && (
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                Visit URL
              </span>
            </a>
          )}

          {/* 5. Download (if media or file) */}
          {isMediaOrFile && (
            <button
              type="button"
              role="menuitem"
              onClick={handleDownload}
              disabled={downloading}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Download className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                {downloading ? "Downloading..." : "Download file"}
              </span>
            </button>
          )}

          {/* 6. Edit Details */}
          {canManage && onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={handleEdit}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#151515] hover:bg-[#F5F1E8] transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Edit3 className="h-3.5 w-3.5 text-[#77736D] group-hover:text-[#151515]" />
                Edit details
              </span>
            </button>
          )}

          {/* Divider & Delete */}
          {canManage && onDelete && (
            <>
              <div className="my-1 border-t border-[#F0EBE1]" />
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#E84B35] hover:bg-[#FFEBE8] transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5 stroke-[1.8]" />
                  Delete
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
