"use client";

import * as React from "react";
import {
  X,
  FileText,
  Code2,
  ExternalLink,
  ClipboardPaste,
  Pin,
  Loader2,
  Tag,
  UploadCloud,
  File,
  Image as ImageIcon,
  Music,
  Video,
  FileBox,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  ClipboardItem,
  ClipboardItemType,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validation/item";
import { uploadFileToR2 } from "./r2-upload-client";
import {
  detectContent,
  classifyFile,
  ClassifiedFile,
} from "./capture";

interface QuickCaptureModalProps {
  isOpen: boolean;
  workspaceId?: string;
  onClose: () => void;
  onItemCreated: (item: ClipboardItem) => void;
  customCreateUrl?: string;
  prefillCalendarDate?: string;
}

export function QuickCaptureModal({
  isOpen,
  workspaceId,
  onClose,
  onItemCreated,
  customCreateUrl,
  prefillCalendarDate,
}: QuickCaptureModalProps) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [detectedType, setDetectedType] = React.useState<"text" | "code" | "link">("text");
  const [detectedLanguage, setDetectedLanguage] = React.useState<string | undefined>(undefined);
  const [tagsInput, setTagsInput] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // File Upload states
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileClassification, setFileClassification] = React.useState<ClassifiedFile | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setDetectedType("text");
      setDetectedLanguage(undefined);
      setTagsInput("");
      setIsPinned(false);
      setError(null);
      setSelectedFile(null);
      setFileClassification(null);
      setUploadProgress(0);
      setIsDragging(false);
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  // Real-time automatic classification as text is typed or pasted
  React.useEffect(() => {
    if (selectedFile) return;
    if (!content.trim()) {
      setDetectedType("text");
      setDetectedLanguage(undefined);
      return;
    }

    const detected = detectContent(content);
    setDetectedType(detected.type);
    setDetectedLanguage(detected.language);

    // Auto-fill title if user hasn't typed one
    if (!title.trim() && detected.title) {
      setTitle(detected.title);
    }
  }, [content, selectedFile, title]);

  if (!isOpen) return null;

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setError("Clipboard API not supported in this browser.");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setError("Clipboard is empty.");
        return;
      }
      setContent(text);
      setSelectedFile(null);
      setFileClassification(null);
      setError(null);
    } catch (err) {
      console.error("Paste error:", err);
      setError("Clipboard read permission denied. Please paste manually.");
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File exceeds 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
      );
      return;
    }

    setSelectedFile(file);
    const classified = classifyFile(file);
    setFileClassification(classified);
    if (!title.trim()) {
      setTitle(file.name);
    }
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileClassification(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    setLoading(true);
    setError(null);

    // If file is selected -> upload flow
    if (selectedFile) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const item = await uploadFileToR2({
          workspaceId: workspaceId || "",
          file: selectedFile,
          title: title.trim(),
          tags,
          isPinned,
          onProgress: (p) => setUploadProgress(p),
          signal: controller.signal,
        });

        onItemCreated(item);
        onClose();
      } catch (err: any) {
        if (err.name === "AbortError") {
          setError("Upload was cancelled.");
        } else {
          setError(err.message || "Failed to upload file.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise text/code/link flow
    if (!content.trim()) {
      setError("Please provide content to save or choose a file.");
      setLoading(false);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const endpoint = customCreateUrl || `/api/workspaces/${workspaceId}/items`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: detectedType,
          title: title.trim(),
          content: content.trim(),
          language: detectedType === "code" ? detectedLanguage : undefined,
          tags,
          isPinned,
          calendarDate: prefillCalendarDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save item.");
      }

      onItemCreated(data.item || data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create item.");
    } finally {
      setLoading(false);
    }
  };

  const renderTypePill = () => {
    if (selectedFile && fileClassification) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
          {fileClassification.type === "image" ? (
            <ImageIcon className="h-3.5 w-3.5" />
          ) : fileClassification.type === "audio" ? (
            <Music className="h-3.5 w-3.5" />
          ) : fileClassification.type === "video" ? (
            <Video className="h-3.5 w-3.5" />
          ) : (
            <FileBox className="h-3.5 w-3.5" />
          )}
          <span>{fileClassification.categoryLabel}</span>
        </span>
      );
    }

    switch (detectedType) {
      case "code":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Code2 className="h-3.5 w-3.5" />
            <span>Code {detectedLanguage ? `(${detectedLanguage})` : ""}</span>
          </span>
        );
      case "link":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Web Link</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            <FileText className="h-3.5 w-3.5" />
            <span>Note</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in-0">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-foreground">Save to Clipboard</h2>
            {renderTypePill()}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Title
            </label>
            <Input
              type="text"
              placeholder="Give this item a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
              autoFocus
            />
          </div>

          {/* Selected File Banner OR Content Input */}
          {selectedFile && fileClassification ? (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <File className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fileClassification.formattedSize} • {fileClassification.mimeType}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  disabled={loading}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </Button>
              </div>

              {loading && uploadProgress > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">
                  Content or Drop File
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    <span>Paste Clipboard</span>
                  </button>
                  <span className="text-muted-foreground text-[10px]">or</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    <UploadCloud className="h-3 w-3" />
                    <span>Choose File</span>
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                <textarea
                  rows={5}
                  placeholder="Paste or type anything here... Text, code, links, or drop a file."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full resize-y bg-transparent p-3 text-xs font-mono text-foreground focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Tags (comma separated)
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="docs, sprint-4, reference..."
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
          </div>

          {/* Pin to top */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pin-checkbox-quick"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label
              htmlFor="pin-checkbox-quick"
              className="text-xs text-foreground font-medium cursor-pointer flex items-center gap-1"
            >
              <Pin className="h-3.5 w-3.5 text-amber-500" />
              <span>Pin this item to top of board</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="text-xs font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save to Board</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
