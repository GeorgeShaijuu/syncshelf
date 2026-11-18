"use client";

import * as React from "react";
import Link from "next/link";
import {
  Layers,
  FileText,
  Code2,
  Link2,
  Image as ImageIcon,
  Music,
  Video,
  FileBox,
  Copy,
  Check,
  Download,
  ExternalLink,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Calendar,
  Sparkles,
  Loader2,
  Share2,
  Search,
  Upload,
  Plus,
  LogIn,
  Eye,
  Edit3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";
import {
  PublicClipboardItem,
  PublicShareMetadata,
  ShareScope,
  SharePermission,
} from "@/lib/validation/share";
import { ClipboardItem } from "@/lib/validation/item";
import { useAuth } from "@/features/auth/auth-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { BoardCanvas } from "@/features/clipboard/board/board-canvas";
import { BoardProvider, useBoard } from "@/features/clipboard/board/board-context";
import { CalendarView } from "@/features/calendar/calendar-view";
import { QuickCaptureModal } from "@/features/clipboard/quick-capture-modal";
import { Workspace } from "@/features/workspaces/workspace-context";
import { cn } from "@/lib/utils";

interface PublicShareClientViewProps {
  token: string;
}

export function PublicShareClientView({ token }: PublicShareClientViewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [errorStatus, setErrorStatus] = React.useState<
    "not_found" | "revoked" | "expired" | "unavailable" | "auth_required" | "forbidden" | "error" | null
  >(null);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [shareMetadata, setShareMetadata] = React.useState<PublicShareMetadata | null>(null);
  const [items, setItems] = React.useState<ClipboardItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<"board" | "calendar">("board");
  const [searchFilter, setSearchFilter] = React.useState("");

  // Editor creation modal state
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false);
  const [captureCalendarDate, setCaptureCalendarDate] = React.useState<string | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Selected items view state
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);

  // Helper to map PublicClipboardItem to internal ClipboardItem
  const mapPublicToInternal = React.useCallback(
    (item: PublicClipboardItem, wsId: string): ClipboardItem => ({
      id: item.id,
      workspaceId: wsId,
      type: item.type,
      title: item.title,
      content: item.content,
      language: item.language,
      url: item.url,
      fileName: item.fileName,
      originalFileName: item.fileName,
      sizeBytes: item.fileSizeBytes,
      mimeType: item.mimeType,
      isPinned: Boolean(item.isPinned),
      calendarDate: item.calendarDate || undefined,
      createdBy: "shared",
      tags: [],
      contentLength: item.content?.length || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || item.createdAt,
      presignedUrl: item.presignedUrl,
    }),
    []
  );

  // 1. Initial Data Fetch
  React.useEffect(() => {
    let isMounted = true;

    async function fetchShare() {
      setLoading(true);
      setErrorStatus(null);
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/public/shares/${encodeURIComponent(token)}`, {
          headers: {
            ...authHeaders,
            Accept: "application/json",
          },
        });

        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          setShareMetadata(data.share);
          const mapped = (data.items || []).map((it: PublicClipboardItem) =>
            mapPublicToInternal(it, data.share.id)
          );
          setItems(mapped);

          // If scope is calendar, set activeTab to calendar
          if (data.share.scope === "calendar") {
            setActiveTab("calendar");
          }

          // If user is authenticated, register Recently Viewed in background
          if (user) {
            fetch("/api/user/recent-shares", {
              method: "POST",
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                shareId: data.share.id,
                token,
                workspaceName: data.share.workspaceName,
                title: data.share.title,
                scope: data.share.scope,
                effectivePermission: data.share.effectivePermission,
              }),
            }).catch(() => {});
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401 || errData.requiresAuth) {
            setErrorStatus("auth_required");
          } else if (res.status === 403) {
            setErrorStatus("forbidden");
          } else if (res.status === 410) {
            setErrorStatus(errData.status === "expired" ? "expired" : "revoked");
          } else {
            setErrorStatus("not_found");
          }
          setErrorMessage(errData.error || "Unable to load shared content.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorStatus("error");
        setErrorMessage(err.message || "Network error loading shared content.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchShare();

    return () => {
      isMounted = false;
    };
  }, [token, user, mapPublicToInternal]);

  // 2. Real-Time Collaboration via SSE Stream
  React.useEffect(() => {
    if (!shareMetadata || errorStatus) return;

    let isSubscribed = true;
    const controller = new AbortController();

    async function setupStream() {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `/api/public/shares/${encodeURIComponent(token)}/stream`,
          {
            headers: {
              ...authHeaders,
              Accept: "text/event-stream",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (isSubscribed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const block of lines) {
            if (!block.trim() || block.startsWith(":")) continue;

            const eventMatch = block.match(/^event:\s*(.+)$/m);
            const dataMatch = block.match(/^data:\s*(.+)$/m);

            const event = eventMatch ? eventMatch[1].trim() : "message";
            const data = dataMatch ? JSON.parse(dataMatch[1]) : {};

            if (!isSubscribed) return;

            if (event === "share:revoked") {
              setErrorStatus("revoked");
              setErrorMessage("This share link has been revoked by the workspace owner.");
              return;
            } else if (event === "share:expired") {
              setErrorStatus("expired");
              setErrorMessage("This share link has expired.");
              return;
            } else if (event === "sync:init") {
              if (Array.isArray(data.items)) {
                setItems(
                  data.items.map((it: PublicClipboardItem) =>
                    mapPublicToInternal(it, shareMetadata?.id || "shared")
                  )
                );
              }
            } else if (event === "item:created") {
              if (data.item) {
                const newItem = mapPublicToInternal(data.item, shareMetadata?.id || "shared");
                setItems((prev) => {
                  if (prev.some((it) => it.id === newItem.id)) return prev;
                  return [newItem, ...prev];
                });
              }
            } else if (event === "item:updated") {
              if (data.item) {
                const updated = mapPublicToInternal(data.item, shareMetadata?.id || "shared");
                setItems((prev) =>
                  prev.map((it) => (it.id === updated.id ? updated : it))
                );
              }
            } else if (event === "item:deleted") {
              if (data.itemId) {
                setItems((prev) => prev.filter((it) => it.id !== data.itemId));
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("[Shared Stream Error]", err);
        }
      }
    }

    setupStream();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [shareMetadata, errorStatus, token, mapPublicToInternal]);

  // Editor mutation handlers
  const canEdit = shareMetadata?.effectivePermission === "editor";

  const handlePinToggle = async (item: ClipboardItem) => {
    if (!canEdit) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/public/shares/${encodeURIComponent(token)}/items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isPinned: !item.isPinned }),
        }
      );
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, isPinned: !item.isPinned } : it
          )
        );
      }
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleItemCreated = (createdItem: ClipboardItem) => {
    setItems((prev) => {
      if (prev.some((it) => it.id === createdItem.id)) return prev;
      return [createdItem, ...prev];
    });
  };

  const handleItemUpdated = (updatedItem: ClipboardItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
    );
  };

  const handleItemDeleted = async (itemId: string) => {
    if (!canEdit) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/public/shares/${encodeURIComponent(token)}/items/${itemId}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handlePasteCapture = (dateString?: string) => {
    if (!canEdit) return;
    setCaptureCalendarDate(dateString);
    setQuickCaptureOpen(true);
  };

  // Upload handler for Editors
  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !canEdit) return;
    const file = e.target.files[0];
    const authHeaders = await getAuthHeaders();

    try {
      // 1. Sign
      const signRes = await fetch(
        `/api/public/shares/${encodeURIComponent(token)}/upload`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "sign",
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type || "application/octet-stream",
            type: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("audio/")
              ? "audio"
              : file.type.startsWith("video/")
              ? "video"
              : "file",
          }),
        }
      );

      if (!signRes.ok) throw new Error("Upload signing failed");
      const signData = await signRes.json();

      // 2. Direct PUT to R2
      await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      // 3. Finalize
      const finalizeRes = await fetch(
        `/api/public/shares/${encodeURIComponent(token)}/upload`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "finalize",
            intentToken: signData.intentToken,
            title: file.name,
          }),
        }
      );

      if (finalizeRes.ok) {
        const finalizeData = await finalizeRes.json();
        if (finalizeData.item) {
          handleItemCreated(
            mapPublicToInternal(finalizeData.item, shareMetadata?.id || "")
          );
        }
      }
    } catch (err) {
      console.error("Shared file upload failed:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Global Ctrl+V / Cmd+V paste handler for Editors
  React.useEffect(() => {
    if (!canEdit) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const text = e.clipboardData?.getData("text");
      if (text && text.trim()) {
        try {
          const authHeaders = await getAuthHeaders();
          const res = await fetch(
            `/api/public/shares/${encodeURIComponent(token)}/items`,
            {
              method: "POST",
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                content: text,
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.item) {
              handleItemCreated(
                mapPublicToInternal(data.item, shareMetadata?.id || "")
              );
            }
          }
        } catch (err) {
          console.error("Failed to paste clip:", err);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [canEdit, token, shareMetadata, mapPublicToInternal]);

  // Selected items view copy helpers
  const copyToClipboard = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  const copyAllItems = () => {
    if (items.length === 0) return;
    const combined = items
      .map((item) => {
        let content = item.content;
        if (item.url) content = item.url;
        return `### ${item.title || "Snippet"}\n${content}`;
      })
      .join("\n\n---\n\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(combined).then(() => {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "code":
        return Code2;
      case "link":
        return Link2;
      case "image":
        return ImageIcon;
      case "audio":
        return Music;
      case "video":
        return Video;
      case "file":
        return FileBox;
      default:
        return FileText;
    }
  };

  // Shared workspace mock for components
  const sharedWorkspace: Workspace = React.useMemo(
    () => ({
      id: shareMetadata?.id || "shared",
      name: shareMetadata?.workspaceName || "Shared Workspace",
      role: canEdit ? "editor" : "viewer",
      ownerUid: "",
      memberCount: 1,
      isOwner: false,
      createdAt: new Date().toISOString(),
    }),
    [shareMetadata, canEdit]
  );

  // Filter items by search
  const filteredItems = React.useMemo(() => {
    if (!searchFilter.trim()) return items;
    const q = searchFilter.toLowerCase();
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.content?.toLowerCase().includes(q) ||
        it.fileName?.toLowerCase().includes(q)
    );
  }, [items, searchFilter]);

  return (
    <BoardProvider>
      <div className="relative min-h-screen bg-[#FAF7F0] text-[#24211F] flex flex-col selection:bg-[#F58B35]/20 selection:text-[#F58B35] overflow-x-hidden">
        <OrganicBackgroundArtwork />

        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b border-[#EDE5D9] bg-[#FFFEFA]/90 backdrop-blur-md px-4 sm:px-6 h-14 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-2">
              <span className="font-bold text-base text-[#24211F] tracking-tight">
                syncshelf
              </span>
            </Link>
            <div className="h-4 w-[1px] bg-[#EDE5D9]" />

            {shareMetadata ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#24211F] flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-[#F58B35]" />
                  <span>{shareMetadata.workspaceName}</span>
                </span>
                {shareMetadata.title && (
                  <span className="text-xs text-[#736B63] hidden sm:inline">
                    • {shareMetadata.title}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-[#736B63]">Shared Content</span>
            )}
          </div>

          {/* Center: Scope View Switcher (for workspace scope) & Search */}
          {shareMetadata && shareMetadata.scope === "workspace" && (
            <div className="hidden md:flex items-center gap-1 bg-[#F5EFE5] p-1 rounded-xl border border-[#EDE5D9]">
              <button
                type="button"
                onClick={() => setActiveTab("board")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors",
                  activeTab === "board"
                    ? "bg-white text-[#24211F] shadow-xs"
                    : "text-[#736B63] hover:text-[#24211F]"
                )}
              >
                <Layers className="h-3.5 w-3.5 text-[#F58B35]" />
                <span>Board Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("calendar")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors",
                  activeTab === "calendar"
                    ? "bg-white text-[#24211F] shadow-xs"
                    : "text-[#736B63] hover:text-[#24211F]"
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-[#F58B35]" />
                <span>Calendar</span>
              </button>
            </div>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {shareMetadata && (
              <span
                className={cn(
                  "text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs border",
                  canEdit
                    ? "bg-[#FFE4D0] text-[#F58B35] border-[#F5C6A3]"
                    : "bg-[#F5EFE5] text-[#736B63] border-[#EDE5D9]"
                )}
              >
                {canEdit ? (
                  <>
                    <Edit3 className="h-3 w-3 stroke-[2.2]" />
                    <span>Editor (Collaborative)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3 stroke-[2.2]" />
                    <span>Viewer (Read-Only)</span>
                  </>
                )}
              </span>
            )}

            {/* Editor Action Buttons */}
            {canEdit && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => handlePasteCapture()}
                  className="h-8 px-3 text-xs bg-[#F58B35] text-white hover:bg-[#E07928] rounded-xl gap-1 shadow-xs font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Clip</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerUpload}
                  className="h-8 px-2.5 text-xs border-[#EDE5D9] hover:bg-[#F5EFE5] rounded-xl text-[#524B43]"
                  title="Upload file"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Copy All for Selected Items */}
            {shareMetadata?.scope === "selected_items" && items.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyAllItems}
                className="text-xs h-8 gap-1.5 font-normal rounded-xl border-[#EDE5D9]"
              >
                {copiedAll ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied All</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy All</span>
                  </>
                )}
              </Button>
            )}

            {/* Auth Indicator */}
            {user ? (
              <div
                className="h-7 w-7 rounded-full bg-[#FFE4D0] border border-[#F58B35]/30 text-[#F58B35] font-bold text-xs flex items-center justify-center"
                title={`Signed in as ${user.email}`}
              >
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </div>
            ) : (
              <Link href={`/login?next=/s/${token}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1 text-[#736B63] hover:text-[#24211F]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#F58B35]" />
              <p className="text-xs text-[#736B63] font-mono">
                Connecting to live shared workspace...
              </p>
            </div>
          ) : errorStatus ? (
            /* Error & Auth States */
            <div className="max-w-md mx-auto my-16 p-8 rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] shadow-xl text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-[#FFE4D0] text-[#F58B35] flex items-center justify-center mx-auto shadow-xs">
                {errorStatus === "auth_required" ? (
                  <LogIn className="h-6 w-6" />
                ) : errorStatus === "forbidden" ? (
                  <Lock className="h-6 w-6" />
                ) : errorStatus === "revoked" ? (
                  <Lock className="h-6 w-6" />
                ) : errorStatus === "expired" ? (
                  <Clock className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>

              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-[#24211F]">
                  {errorStatus === "auth_required"
                    ? "Sign In Required"
                    : errorStatus === "forbidden"
                    ? "Access Denied"
                    : errorStatus === "revoked"
                    ? "Share Link Revoked"
                    : errorStatus === "expired"
                    ? "Share Link Expired"
                    : "Share Link Not Found"}
                </h2>
                <p className="text-xs text-[#736B63] leading-relaxed">
                  {errorMessage ||
                    (errorStatus === "auth_required"
                      ? "This workspace link requires signing in to a SyncShelf account."
                      : errorStatus === "forbidden"
                      ? "Your account does not have permission to access this shared link."
                      : "This share link is no longer available.")}
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                {errorStatus === "auth_required" ? (
                  <Link href={`/login?next=/s/${token}`}>
                    <Button className="bg-[#F58B35] text-white hover:bg-[#E07928] text-xs h-9 px-5 rounded-xl font-semibold gap-1.5">
                      <LogIn className="h-4 w-4" />
                      <span>Sign In to Continue</span>
                    </Button>
                  </Link>
                ) : (
                  <Link href="/">
                    <Button
                      variant="outline"
                      className="text-xs h-9 px-4 rounded-xl border-[#EDE5D9]"
                    >
                      <span>Go to SyncShelf</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : shareMetadata ? (
            /* Render Scoped Content */
            shareMetadata.scope === "board" ||
            (shareMetadata.scope === "workspace" && activeTab === "board") ? (
              /* 1. Live Board Canvas */
              <div className="h-[calc(100vh-3.5rem)] w-full overflow-hidden">
                <BoardCanvas
                  workspace={sharedWorkspace}
                  items={filteredItems}
                  loading={false}
                  canManage={canEdit}
                  onPinToggle={handlePinToggle}
                  onItemCreated={handleItemCreated}
                  onItemUpdated={handleItemUpdated}
                  onItemDeleted={handleItemDeleted}
                  customUpdateUrl={(it) => `/api/public/shares/${encodeURIComponent(token)}/items/${it.id}`}
                  customDeleteUrl={(it) => `/api/public/shares/${encodeURIComponent(token)}/items/${it.id}`}
                  customCreateUrl={`/api/public/shares/${encodeURIComponent(token)}/items`}
                />
              </div>
            ) : shareMetadata.scope === "calendar" ||
              (shareMetadata.scope === "workspace" && activeTab === "calendar") ? (
              /* 2. Live Calendar View */
              <div className="h-[calc(100vh-3.5rem)] w-full overflow-y-auto p-4 sm:p-6">
                <CalendarView
                  workspace={sharedWorkspace}
                  items={filteredItems}
                  canManage={canEdit}
                  onPinToggle={handlePinToggle}
                  onItemUpdated={handleItemUpdated}
                  onItemDeleted={handleItemDeleted}
                  onPasteCapture={handlePasteCapture}
                  customUpdateUrl={(it) => `/api/public/shares/${encodeURIComponent(token)}/items/${it.id}`}
                  customDeleteUrl={(it) => `/api/public/shares/${encodeURIComponent(token)}/items/${it.id}`}
                />
              </div>
            ) : (
              /* 3. Selected Items View */
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                {/* Shelf Metadata Banner */}
                <div className="rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] p-5 sm:p-6 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#736B63] font-medium">Shared from</span>
                        <span className="text-sm font-bold text-[#24211F] flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-[#F58B35]" />
                          {shareMetadata.workspaceName}
                        </span>
                      </div>
                      <p className="text-xs text-[#736B63]">
                        {items.length === 1
                          ? "1 shared clipboard clip"
                          : `${items.length} shared clipboard clips`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#736B63]">
                      <div className="flex items-center gap-1 bg-[#F5EFE5] px-2.5 py-1 rounded-lg border border-[#EDE5D9] text-[11px]">
                        <Calendar className="h-3 w-3 text-[#736B63]" />
                        <span>Created {formatDate(shareMetadata.createdAt)}</span>
                      </div>

                      {shareMetadata.expiresAt ? (
                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                          <Clock className="h-3 w-3" />
                          <span>Expires {formatDate(shareMetadata.expiresAt)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-[#F5EFE5] px-2.5 py-1 rounded-lg border border-[#EDE5D9] text-[11px]">
                          <Clock className="h-3 w-3 text-[#736B63]" />
                          <span>Never expires</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* List of Shared Items */}
                <div className="space-y-6">
                  {filteredItems.map((item, index) => {
                    const Icon = getItemIcon(item.type);
                    const isCopied = copiedId === item.id;

                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] shadow-xs overflow-hidden transition-all hover:border-[#F58B35]/40"
                      >
                        {/* Item Card Header */}
                        <div className="flex items-center justify-between border-b border-[#EDE5D9] bg-[#FAF7F0] px-4 py-3">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFE4D0] text-[#F58B35] shadow-2xs">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="truncate">
                              <h3 className="truncate text-xs font-bold text-[#24211F]">
                                {item.title || `Shared Clip #${index + 1}`}
                              </h3>
                              <span className="text-[10px] text-[#736B63] capitalize font-mono">
                                {item.type} {item.language ? `• ${item.language}` : ""}{" "}
                                {item.sizeBytes ? `• ${formatFileSize(item.sizeBytes)}` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {(item.type === "text" || item.type === "code" || item.type === "link") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(item.url || item.content, item.id)}
                                className="h-7 px-2.5 text-xs gap-1 text-[#736B63] hover:text-[#24211F] rounded-lg"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-[11px] text-emerald-500 font-medium">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span className="text-[11px]">Copy</span>
                                  </>
                                )}
                              </Button>
                            )}

                            {item.presignedUrl && (
                              <a
                                href={item.presignedUrl}
                                download={item.fileName || "download"}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs gap-1 border-[#EDE5D9] font-normal rounded-lg"
                                >
                                  <Download className="h-3.5 w-3.5 text-[#F58B35]" />
                                  <span className="text-[11px]">Download</span>
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Item Card Body */}
                        <div className="p-4 sm:p-5">
                          {item.type === "code" && (
                            <div className="relative">
                              <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100 border border-zinc-800 leading-relaxed max-h-[500px]">
                                <code>{item.content}</code>
                              </pre>
                            </div>
                          )}

                          {item.type === "text" && (
                            <div className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#24211F] font-sans max-h-[500px] overflow-y-auto">
                              {item.content}
                            </div>
                          )}

                          {item.type === "link" && (
                            <div className="space-y-3">
                              {item.content && (
                                <p className="text-xs text-[#736B63]">{item.content}</p>
                              )}
                              {item.url && (
                                <div className="flex items-center justify-between rounded-xl border border-[#EDE5D9] bg-[#FAF7F0] p-3 text-xs">
                                  <span className="truncate font-mono text-[#F58B35] mr-2">
                                    {item.url}
                                  </span>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] font-medium text-[#24211F] hover:text-[#F58B35] transition-colors shrink-0"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {item.type === "image" && (
                            <div className="space-y-3">
                              {item.presignedUrl ? (
                                <div className="overflow-hidden rounded-xl border border-[#EDE5D9] bg-[#FAF7F0] flex items-center justify-center max-h-[500px]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.presignedUrl}
                                    alt={item.title || item.fileName || "Shared Image"}
                                    className="object-contain max-h-[500px] w-auto h-auto rounded"
                                  />
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[#EDE5D9] p-6 text-center text-xs text-[#736B63]">
                                  Image preview unavailable
                                </div>
                              )}
                            </div>
                          )}

                          {item.type === "audio" && (
                            <div className="space-y-3">
                              {item.presignedUrl ? (
                                <div className="rounded-xl border border-[#EDE5D9] bg-[#FAF7F0] p-4">
                                  <audio
                                    controls
                                    className="w-full h-10 rounded focus:outline-none"
                                    src={item.presignedUrl}
                                  >
                                    Your browser does not support the audio element.
                                  </audio>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[#EDE5D9] p-6 text-center text-xs text-[#736B63]">
                                  Audio playback unavailable
                                </div>
                              )}
                            </div>
                          )}

                          {item.type === "video" && (
                            <div className="space-y-3">
                              {item.presignedUrl ? (
                                <div className="rounded-xl border border-[#EDE5D9] bg-black/60 overflow-hidden flex items-center justify-center">
                                  <video
                                    controls
                                    playsInline
                                    className="w-full max-h-[380px] object-contain rounded"
                                    src={item.presignedUrl}
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[#EDE5D9] p-6 text-center text-xs text-[#736B63]">
                                  Video playback unavailable
                                </div>
                              )}
                            </div>
                          )}

                          {item.type === "file" && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between rounded-xl border border-[#EDE5D9] bg-[#FAF7F0] p-4">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFE4D0] text-[#F58B35]">
                                    <FileBox className="h-5 w-5" />
                                  </div>
                                  <div className="truncate">
                                    <div className="truncate text-xs font-bold text-[#24211F]">
                                      {item.fileName || item.title}
                                    </div>
                                    <div className="text-[10px] text-[#736B63] font-mono">
                                      {item.mimeType || "Binary document"}{" "}
                                      {item.sizeBytes ? `• ${formatFileSize(item.sizeBytes)}` : ""}
                                    </div>
                                  </div>
                                </div>

                                {item.presignedUrl && (
                                  <a
                                    href={item.presignedUrl}
                                    download={item.fileName || "download"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button size="sm" className="h-8 gap-1.5 text-xs rounded-xl bg-[#F58B35] text-white">
                                      <Download className="h-3.5 w-3.5" />
                                      <span>Download</span>
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )
          ) : null}
        </main>

        {/* Quick Capture Modal for Editors */}
        {canEdit && (
          <QuickCaptureModal
            isOpen={quickCaptureOpen}
            onClose={() => {
              setQuickCaptureOpen(false);
              setCaptureCalendarDate(undefined);
            }}
            onItemCreated={handleItemCreated}
            prefillCalendarDate={captureCalendarDate}
            customCreateUrl={`/api/public/shares/${encodeURIComponent(token)}/items`}
          />
        )}

        {/* Footer */}
        <footer className="border-t border-[#EDE5D9] py-4 text-center text-xs text-[#736B63]">
          <div className="flex items-center justify-center gap-2">
            <span>Powered by</span>
            <Link
              href="/"
              className="font-bold text-[#24211F] hover:text-[#F58B35] transition-colors"
            >
              SyncShelf
            </Link>
            <span>&bull;</span>
            <span>Live Collaborative Sharing</span>
          </div>
        </footer>
      </div>
    </BoardProvider>
  );
}
