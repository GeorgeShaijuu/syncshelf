"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  Code2,
  ExternalLink,
  Pin,
  RefreshCw,
  Loader2,
  Inbox,
  Radio,
  WifiOff,
  AlertCircle,
  Image as ImageIcon,
  Music,
  Video,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardCard } from "@/features/clipboard/clipboard-card";
import { QuickCaptureModal } from "@/features/clipboard/quick-capture-modal";
import { UniversalPasteZone } from "@/features/clipboard/universal-paste-zone";
import { EditItemModal } from "@/features/clipboard/edit-item-modal";
import { DeleteItemDialog } from "@/features/clipboard/delete-item-dialog";
import { Workspace } from "@/features/workspaces/workspace-context";
import { ClipboardItem } from "@/lib/validation/item";
import {
  useWorkspaceItems,
  FilterType,
  ConnectionState,
} from "@/features/clipboard/use-workspace-items";

interface ClipboardFeedProps {
  workspace: Workspace;
  initialFilter?: FilterType;
  feedTitle?: string;
  feedDescription?: string;
  hideFilterTabs?: boolean;
}

export function ClipboardFeed({
  workspace,
  initialFilter = "all",
  feedTitle,
  feedDescription,
  hideFilterTabs = false,
}: ClipboardFeedProps) {
  const searchParams = useSearchParams();
  const urlTypeParam = searchParams.get("type") as FilterType | null;

  // Search and Filter states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<FilterType>(
    initialFilter !== "all" ? initialFilter : (urlTypeParam || "all")
  );

  React.useEffect(() => {
    if (initialFilter !== "all") {
      setActiveFilter(initialFilter);
    } else if (urlTypeParam) {
      setActiveFilter(urlTypeParam);
    }
  }, [initialFilter, urlTypeParam]);

  // Realtime hook integrating onSnapshot, hybrid pagination, and optimistic updates
  const {
    items,
    loading,
    connectionState,
    error,
    hasMore,
    isLoadingMore,
    lastSyncedAt,
    loadMore,
    refresh,
    optimisticPinToggle,
    optimisticItemCreated,
    optimisticItemUpdated,
    optimisticItemDeleted,
  } = useWorkspaceItems({
    workspaceId: workspace.id,
    filterType: activeFilter,
    searchQuery,
    pageSize: 20,
  });

  // Modal states
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ClipboardItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<ClipboardItem | null>(null);

  const canManage = workspace.role === "owner" || workspace.role === "editor";

  // Sort items: pinned first, then newest first
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  // Understated Connection Status Indicator
  const renderConnectionBadge = () => {
    switch (connectionState) {
      case "live":
        return (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border"
            title={
              lastSyncedAt
                ? `Saved & in sync. Last updated at ${lastSyncedAt.toLocaleTimeString()}`
                : "Saved & in sync"
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Saved</span>
          </div>
        );
      case "connecting":
      case "reconnecting":
        return (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border"
            title="Syncing workspace changes..."
          >
            <Radio className="h-3 w-3 animate-pulse" />
            <span>Syncing</span>
          </div>
        );
      case "offline":
        return (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border"
            title="Offline mode."
          >
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
          </div>
        );
      case "error":
        return (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20"
            title={error || "Realtime listener error"}
          >
            <AlertCircle className="h-3 w-3" />
            <span>Sync Error</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar if provided */}
      {feedTitle && (
        <div className="pb-2 border-b border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {initialFilter === "pinned" && (
                <Pin className="h-5 w-5 text-amber-500 fill-amber-500/20" />
              )}
              <span>{feedTitle}</span>
            </h1>
            {feedDescription && (
              <p className="text-xs text-muted-foreground mt-0.5">{feedDescription}</p>
            )}
          </div>
          {initialFilter === "pinned" && (
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
              {items.length} {items.length === 1 ? "pinned item" : "pinned items"}
            </span>
          )}
        </div>
      )}

      {/* Universal Paste Target & File Upload */}
      {initialFilter !== "pinned" && (
        <UniversalPasteZone
          workspaceId={workspace.id}
          canEdit={canManage}
          onItemCreated={optimisticItemCreated}
          activeFilter={activeFilter}
          onResetFilter={() => setActiveFilter("all")}
        />
      )}

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search titles, code, content or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refresh();
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime Status Indicator */}
          {renderConnectionBadge()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
            className="h-9 px-3 text-xs"
            title="Manually refresh feed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {canManage && (
            <Button
              size="sm"
              onClick={() => setQuickCaptureOpen(true)}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Quick Capture</span>
            </Button>
          )}
        </div>
      </div>

      {/* Honest Search Scope Notice */}
      {searchQuery.trim() && (
        <div className="text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 flex items-center justify-between">
          <span>
            Searching loaded realtime window ({sortedItems.length} matching items).
          </span>
          <button
            type="button"
            onClick={() => refresh()}
            className="underline hover:text-foreground font-medium"
          >
            Query full workspace
          </button>
        </div>
      )}

      {/* Filter Navigation Tabs */}
      {!hideFilterTabs && initialFilter !== "pinned" && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-border">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "text"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "code"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("link")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "link"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Links</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("image")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "image"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Images</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("audio")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "audio"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Music className="h-3.5 w-3.5" />
            <span>Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "video"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span>Video</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("file")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "file"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span>Files</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("pinned")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === "pinned"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            <span>Pinned</span>
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-44 rounded-xl border border-border/60 bg-muted/20 animate-pulse p-4 space-y-3"
            >
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-16 w-full bg-muted/60 rounded" />
              <div className="h-4 w-1/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No clipboard items found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || activeFilter !== "all"
              ? "No items match your active search or filter. Try clearing filters or searching another keyword."
              : "Your workspace clipboard is currently empty. Use Quick Capture to save notes, code snippets, or links."}
          </p>

          {canManage && !searchQuery && activeFilter === "all" && (
            <div className="mt-5">
              <Button size="sm" onClick={() => setQuickCaptureOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Capture Your First Item
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedItems
            .filter((item) => item && (item.id || item.type))
            .map((item, index) => (
              <ClipboardCard
                key={item.id ? `item-${item.id}` : `fallback-${index}-${item.createdAt || Date.now()}`}
                item={item}
                canManage={canManage}
                onPinToggle={optimisticPinToggle}
                onEdit={setEditingItem}
                onDelete={setDeletingItem}
              />
            ))}
        </div>
      )}

      {/* Pagination Load More */}
      {hasMore && !loading && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMore()}
            disabled={isLoadingMore}
            className="text-xs"
          >
            {isLoadingMore && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Load More Items
          </Button>
        </div>
      )}

      {/* Interactive Modals */}
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        workspaceId={workspace.id}
        onClose={() => setQuickCaptureOpen(false)}
        onItemCreated={optimisticItemCreated}
      />

      <EditItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onItemUpdated={optimisticItemUpdated}
      />

      <DeleteItemDialog
        item={deletingItem}
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onItemDeleted={optimisticItemDeleted}
      />
    </div>
  );
}
