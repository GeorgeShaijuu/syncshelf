"use client";

import * as React from "react";
import {
  FileText,
  Code2,
  ExternalLink,
  Pin,
  Edit2,
  Trash2,
  Copy,
  Check,
  Tag,
  Image as ImageIcon,
  Music,
  Video,
  Download,
  Eye,
  Loader2,
  FileBox,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import type { ClipboardItem } from "@/lib/validation/item";
import { getFileDownloadUrl } from "./r2-upload-client";

interface ClipboardCardProps {
  item: ClipboardItem;
  canManage: boolean; // owner or editor
  onPinToggle: (item: ClipboardItem) => void;
  onEdit: (item: ClipboardItem) => void;
  onDelete: (item: ClipboardItem) => void;
}

export function ClipboardCard({
  item,
  canManage,
  onPinToggle,
  onEdit,
  onDelete,
}: ClipboardCardProps) {
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // Signed URL state for private media / file access
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const isMediaItem =
    item.type === "image" ||
    item.type === "audio" ||
    item.type === "video" ||
    item.type === "file";

  // Auto-fetch preview URL for image and video items when rendered
  React.useEffect(() => {
    let isMounted = true;
    if (
      (item.type === "image" || item.type === "video") &&
      item.objectKey &&
      !mediaUrl &&
      !loadingMedia
    ) {
      setLoadingMedia(true);
      getFileDownloadUrl(item.workspaceId, item.id, false)
        .then((res) => {
          if (isMounted) {
            setMediaUrl(res.url);
            setMediaError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setMediaError(err.message || "Failed to load media preview.");
          }
        })
        .finally(() => {
          if (isMounted) setLoadingMedia(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.type, item.objectKey, item.workspaceId, mediaUrl, loadingMedia]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (item.type === "image" && mediaUrl) {
      try {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          try {
            const pngBlob =
              blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": pngBlob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
          } catch {
            // Fallback to text copy below
          }
        }
      } catch {
        // Fallback to URL/name copy
      }
    }

    try {
      const copyContent = isMediaItem
        ? mediaUrl || item.originalFileName || item.title
        : item.content || "";
      await navigator.clipboard.writeText(copyContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setMediaError(null);

    try {
      const { url } = await getFileDownloadUrl(item.workspaceId, item.id, true);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.originalFileName || item.title || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      setMediaError(err.message || "Failed to download file.");
    } finally {
      setDownloading(false);
    }
  };

  const handleLoadMedia = async () => {
    if (loadingMedia || mediaUrl) return;
    setLoadingMedia(true);
    setMediaError(null);

    try {
      const res = await getFileDownloadUrl(item.workspaceId, item.id, false);
      setMediaUrl(res.url);
    } catch (err: any) {
      setMediaError(err.message || "Failed to load media stream.");
    } finally {
      setLoadingMedia(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatSize = () => {
    if (item.sizeBytes) {
      if (item.sizeBytes < 1024) return `${item.sizeBytes} B`;
      if (item.sizeBytes < 1024 * 1024)
        return `${(item.sizeBytes / 1024).toFixed(1)} KB`;
      return `${(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    const chars = item.contentLength || item.content?.length || 0;
    if (chars < 1000) return `${chars} chars`;
    return `${(chars / 1024).toFixed(1)} KB`;
  };

  const renderFileIcon = () => {
    const ext = (item.originalFileName || item.title).split(".").pop()?.toLowerCase() || "";
    if (["csv", "xls", "xlsx"].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    }
    if (["zip", "tar", "gz", "rar"].includes(ext)) {
      return <FileArchive className="h-5 w-5 text-amber-600" />;
    }
    if (["js", "ts", "jsx", "tsx", "py", "go", "rs", "json", "html"].includes(ext)) {
      return <FileCode className="h-5 w-5 text-indigo-600" />;
    }
    return <FileBox className="h-5 w-5 text-foreground/70" />;
  };

  const renderTypeIcon = () => {
    switch (item.type) {
      case "code":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Code2 className="h-4 w-4" />
          </div>
        );
      case "link":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ExternalLink className="h-4 w-4" />
          </div>
        );
      case "image":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ImageIcon className="h-4 w-4" />
          </div>
        );
      case "audio":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Music className="h-4 w-4" />
          </div>
        );
      case "video":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Video className="h-4 w-4" />
          </div>
        );
      case "file":
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-muted text-foreground/80">
            <FileBox className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="p-1.5 rounded-lg shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FileText className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <>
      <div
        className={`group relative rounded-xl border transition-all duration-200 bg-card hover:shadow-sm ${
          item.isPinned
            ? "border-amber-500/40 bg-amber-500/[0.02]"
            : "border-border/80 hover:border-border"
        }`}
      >
        {/* Top Card Header */}
        <div className="flex items-start justify-between p-4 pb-2 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {renderTypeIcon()}

            <div className="min-w-0">
              <h3
                className="font-medium text-sm text-foreground truncate"
                title={item.title}
              >
                {item.title}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(item.createdAt)} • {formatSize()}
              </p>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 shrink-0">
            {isMediaItem && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Download file"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => onPinToggle(item)}
                className={`p-1.5 rounded-md transition-colors ${
                  item.isPinned
                    ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={item.isPinned ? "Unpin item" : "Pin to top"}
              >
                <Pin
                  className={`h-3.5 w-3.5 ${item.isPinned ? "fill-current" : ""}`}
                />
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={item.type === "image" ? "Copy image" : "Copy content"}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {canManage && (
              <div className="flex items-center gap-0.5 opacity-90 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Edit item title"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Render */}
        <div className="px-4 py-2">
          {item.type === "code" ? (
            <CodeBlock code={item.content || ""} language={item.language || "plaintext"} />
          ) : item.type === "link" ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <a
                href={item.content || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>{item.content || item.title}</span>
              </a>
            </div>
          ) : item.type === "image" ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2 flex flex-col items-center justify-center min-h-[140px]">
              {loadingMedia ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading preview...</span>
                </div>
              ) : mediaUrl ? (
                <div
                  onClick={() => setIsModalOpen(true)}
                  className="relative group/img max-h-72 w-full flex items-center justify-center overflow-hidden rounded-md cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt={item.title}
                    className="max-h-72 w-auto object-contain rounded-md"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="p-1.5 rounded-md bg-background/90 text-foreground text-xs flex items-center gap-1 shadow">
                      <Eye className="h-3.5 w-3.5" /> View
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    {mediaError || "Preview unavailable."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMediaUrl(null);
                      setLoadingMedia(false);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Retry</span>
                  </Button>
                </div>
              )}
            </div>
          ) : item.type === "video" ? (
            <div className="rounded-lg border border-border/60 bg-black/80 overflow-hidden flex flex-col items-center justify-center min-h-[140px]">
              {loadingMedia ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading video...</span>
                </div>
              ) : mediaUrl ? (
                <video
                  controls
                  playsInline
                  className="w-full max-h-72 object-contain"
                  src={mediaUrl}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <Video className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    {mediaError || "Video preview unavailable."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMedia}
                    className="h-7 text-xs gap-1"
                  >
                    <Video className="h-3 w-3" />
                    <span>Load Video</span>
                  </Button>
                </div>
              )}
            </div>
          ) : item.type === "audio" ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="truncate text-foreground">
                  {item.originalFileName || item.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatSize()}
                </span>
              </div>

              {mediaUrl ? (
                <audio controls className="w-full h-8 mt-1" src={mediaUrl}>
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Audio recording
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMedia}
                    disabled={loadingMedia}
                    className="h-7 text-xs gap-1"
                  >
                    {loadingMedia ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Music className="h-3 w-3" />
                    )}
                    <span>Play</span>
                  </Button>
                </div>
              )}
            </div>
          ) : item.type === "file" ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-muted shrink-0">
                  {renderFileIcon()}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium text-foreground truncate"
                    title={item.originalFileName || item.title}
                  >
                    {item.originalFileName || item.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize()}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download</span>
              </Button>
            </div>
          ) : (
            /* Text Item */
            (() => {
              const text = item.content || "";
              return (
                <div className="text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {text.length > 280 && !expanded ? (
                    <>
                      <span>{text.slice(0, 280)}...</span>
                      <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        className="ml-1 text-xs text-primary hover:underline font-medium inline-block"
                      >
                        Show more
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{text}</span>
                      {text.length > 280 && (
                        <button
                          type="button"
                          onClick={() => setExpanded(false)}
                          className="ml-1 text-xs text-primary hover:underline font-medium inline-block"
                        >
                          Show less
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Tags and Badges Footer */}
        {((Array.isArray(item.tags) && item.tags.length > 0) || (item.type === "code" && item.language)) && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-1 text-[11px]">
            {item.type === "code" && item.language && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {item.language}
              </Badge>
            )}

            {(Array.isArray(item.tags) ? item.tags : []).map((tag, tagIdx) => (
              <span
                key={`${tag}-${tagIdx}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px]"
              >
                <Tag className="h-2.5 w-2.5 opacity-60" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Full Size Image Preview Modal */}
      {isModalOpen && mediaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl p-2 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-background/80 hover:bg-muted text-foreground transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={item.title}
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
            <div className="w-full flex items-center justify-between pt-2 px-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground truncate">{item.title}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-7 text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
