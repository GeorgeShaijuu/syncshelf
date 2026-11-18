"use client";

import * as React from "react";
import {
  ClipboardPaste,
  UploadCloud,
  FileCode2,
  Link2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { ClipboardItem } from "@/lib/validation/item";
import { uploadFileToR2 } from "./r2-upload-client";
import {
  useGlobalPasteCapture,
  extractDataTransferPayload,
  CapturedClipboardPayload,
  detectContent,
  classifyFile,
  CapturedFileItem,
} from "./capture";

interface UniversalPasteZoneProps {
  workspaceId: string;
  canEdit: boolean;
  onItemCreated: (item: ClipboardItem) => void;
  activeFilter?: string;
  onResetFilter?: () => void;
}

interface UploadStatus {
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function UniversalPasteZone({
  workspaceId,
  canEdit,
  onItemCreated,
  activeFilter,
  onResetFilter,
}: UniversalPasteZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [activeMessage, setActiveMessage] = React.useState<{
    type: "info" | "success" | "error";
    text: string;
    filterHint?: string;
  } | null>(null);
  const [uploadStatuses, setUploadStatuses] = React.useState<UploadStatus[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Clear temporary messages after a timeout
  React.useEffect(() => {
    if (!activeMessage || activeMessage.type === "info") return;
    const timer = setTimeout(() => {
      setActiveMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeMessage]);

  /**
   * Saves text, code, or link items to Firestore via API
   */
  const handleSaveContent = async (detected: {
    type: "text" | "code" | "link";
    title: string;
    content: string;
    language?: string;
  }) => {
    if (!canEdit) {
      setActiveMessage({
        type: "error",
        text: "You have view-only access to this workspace.",
      });
      return;
    }

    setIsProcessing(true);
    setActiveMessage({
      type: "info",
      text: `Recognized ${detected.type === "code" ? (detected.language || "code") : detected.type} • Saving...`,
    });

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/items`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: detected.type,
          title: detected.title,
          content: detected.content,
          language: detected.language,
          isPinned: false,
          tags: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save item.");
      }

      const createdItem: ClipboardItem = data.item || data;
      onItemCreated(createdItem);

      const typeLabel =
        detected.type === "code"
          ? `${detected.language || "Code"} snippet`
          : detected.type === "link"
          ? "Web link"
          : "Note";

      const showFilterHint =
        activeFilter &&
        activeFilter !== "all" &&
        activeFilter !== detected.type;

      setActiveMessage({
        type: "success",
        text: `Saved ${typeLabel}: "${detected.title}"`,
        filterHint: showFilterHint ? activeFilter : undefined,
      });
    } catch (err: any) {
      console.error("[SyncShelf] Paste save error:", err);
      setActiveMessage({
        type: "error",
        text: err?.message || "Could not save pasted content.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles uploading classified files (images, audio, video, documents)
   */
  const handleUploadFiles = async (files: (File | CapturedFileItem)[]) => {
    if (!canEdit) {
      setActiveMessage({
        type: "error",
        text: "You have view-only access to this workspace.",
      });
      return;
    }

    if (files.length === 0) return;

    setIsProcessing(true);
    const initialStatuses: UploadStatus[] = files.map((f) => ({
      fileName: "file" in f ? f.fileName : f.name,
      progress: 0,
      status: "pending",
    }));
    setUploadStatuses(initialStatuses);

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const file = "file" in item ? item.file : item;
      const fileName = file.name;

      setUploadStatuses((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, status: "uploading", progress: 5 } : s
        )
      );

      try {
        const createdItem = await uploadFileToR2({
          workspaceId,
          file,
          title: fileName,
          onProgress: (percent) => {
            setUploadStatuses((prev) =>
              prev.map((s, idx) =>
                idx === i ? { ...s, progress: Math.max(percent, 5) } : s
              )
            );
          },
        });

        setUploadStatuses((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", progress: 100 } : s
          )
        );

        onItemCreated(createdItem);
        successCount++;
      } catch (err: any) {
        console.error(`[SyncShelf] Upload failed for ${fileName}:`, err);
        setUploadStatuses((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "error", error: err?.message || "Upload failed" } : s
          )
        );
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      setActiveMessage({
        type: "success",
        text:
          files.length === 1
            ? `Uploaded ${files[0] instanceof File ? files[0].name : files[0].fileName}`
            : `Successfully uploaded ${successCount} of ${files.length} files.`,
      });
    }

    // Clear upload statuses after 3 seconds
    setTimeout(() => {
      setUploadStatuses([]);
    }, 3000);
  };

  /**
   * Unified capture handler for any clipboard payload
   */
  const processPayload = async (payload: CapturedClipboardPayload) => {
    if (payload.kind === "empty") return;

    if (payload.kind === "files") {
      await handleUploadFiles(payload.files);
    } else if (payload.kind === "content") {
      await handleSaveContent(payload.content);
    }
  };

  // Attach global keyboard paste listener (Ctrl+V / Cmd+V)
  useGlobalPasteCapture({
    onCapture: (payload) => {
      processPayload(payload);
    },
    enabled: canEdit,
  });

  // Drag and Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging && canEdit) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only cancel if leaving the outer container
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!canEdit) return;

    const payload = extractDataTransferPayload(e.dataTransfer);
    await processPayload(payload);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    handleUploadFiles(fileList);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full mb-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Interactive Paste / Drop Canvas */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group rounded-xl border-2 transition-all duration-200 px-6 py-5 bg-card/60 backdrop-blur-sm ${
          isDragging
            ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-lg scale-[1.005]"
            : "border-dashed border-border/80 hover:border-border hover:bg-muted/20"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isDragging
                  ? "bg-primary text-primary-foreground scale-110 shadow-md"
                  : "bg-muted text-foreground/80 group-hover:bg-primary/10 group-hover:text-primary"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : isDragging ? (
                <FileUp className="h-6 w-6 animate-bounce" />
              ) : (
                <ClipboardPaste className="h-6 w-6" />
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2 justify-center sm:justify-start">
                <span>{isDragging ? "Drop anywhere to save" : "Paste anything here"}</span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/60">
                  Ctrl + V
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/60">
                  ⌘ + V
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Copy text, code, links, images, or media from anywhere. SyncShelf auto-organizes it.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit || isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3.5 text-xs font-medium gap-2 border-border/80 hover:bg-accent"
            >
              <UploadCloud className="h-4 w-4 text-muted-foreground" />
              <span>Upload files</span>
            </Button>
          </div>
        </div>

        {/* Live Upload Progress Bars */}
        {uploadStatuses.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
            {uploadStatuses.map((st, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate max-w-[200px] text-foreground font-mono text-[11px]">
                  {st.fileName}
                </span>
                <div className="flex-1 max-w-[180px] bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      st.status === "error"
                        ? "bg-destructive"
                        : st.status === "done"
                        ? "bg-primary"
                        : "bg-primary/80"
                    }`}
                    style={{ width: `${st.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
                  {st.status === "error" ? "Err" : `${st.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Feedback message banner */}
        {activeMessage && (
          <div
            className={`mt-3.5 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
              activeMessage.type === "success"
                ? "bg-primary/10 text-primary border border-primary/20"
                : activeMessage.type === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              {activeMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : activeMessage.type === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              )}
              <span className="font-medium">{activeMessage.text}</span>
            </div>

            {activeMessage.filterHint && onResetFilter && (
              <button
                type="button"
                onClick={onResetFilter}
                className="ml-3 underline hover:opacity-80 text-[11px] font-semibold shrink-0"
              >
                Show all items
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
