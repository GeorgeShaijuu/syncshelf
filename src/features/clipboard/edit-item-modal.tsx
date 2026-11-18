"use client";

import * as React from "react";
import { X, Loader2, Pin, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";

interface EditItemModalProps {
  item: ClipboardItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated: (item: ClipboardItem) => void;
  customUpdateUrl?: (item: ClipboardItem) => string;
}

const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "json",
  "bash",
  "html",
  "css",
  "sql",
  "go",
  "rust",
  "markdown",
  "plaintext",
];

export function EditItemModal({
  item,
  isOpen,
  onClose,
  onItemUpdated,
  customUpdateUrl,
}: EditItemModalProps) {
  const [type, setType] = React.useState<ClipboardItemType>("text");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [language, setLanguage] = React.useState("typescript");
  const [tagsInput, setTagsInput] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isMediaItem =
    item?.type === "image" ||
    item?.type === "audio" ||
    item?.type === "video" ||
    item?.type === "file";

  React.useEffect(() => {
    if (item && isOpen) {
      setType(item.type);
      setTitle(item.title);
      setContent(item.content);
      setLanguage(item.language || "typescript");
      setTagsInput((item.tags || []).join(", "));
      setIsPinned(item.isPinned);
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!isMediaItem && !content.trim()) {
      setError("Content cannot be empty.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload: Record<string, any> = {
        title: title.trim(),
        tags,
        isPinned,
      };

      if (!isMediaItem) {
        payload.type = type;
        payload.content = content.trim();
        if (type === "code") {
          payload.language = language;
        }
      }

      const url = customUpdateUrl
        ? customUpdateUrl(item)
        : `/api/workspaces/${item.workspaceId}/items/${item.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update clipboard item.");
      }

      onItemUpdated(data.item);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit Item</h2>
            <p className="text-xs text-muted-foreground">
              Modify title, tags, and workspace metadata
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="text-xs"
            />
          </div>

          {isMediaItem ? (
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
              <p className="text-xs font-medium text-foreground">
                Stored Private Object: {item.originalFileName || item.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                MIME: {item.mimeType || "application/octet-stream"} • Size:{" "}
                {item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : "N/A"}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Content <span className="text-destructive">*</span>
              </label>
              {type === "link" ? (
                <Input
                  type="url"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={50000}
                  required
                  className="text-xs font-mono"
                />
              ) : (
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={50000}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              )}
            </div>
          )}

          {!isMediaItem && type === "code" && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Tags <span className="text-muted-foreground">(comma-separated)</span>
              </label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center md:items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <Pin className="h-3.5 w-3.5 text-amber-500" />
                <span>Pin to top of workspace</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
