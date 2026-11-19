"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useWorkspace, Workspace } from "@/features/workspaces/workspace-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { getRelativeTimeString } from "@/features/clipboard/board/board-card-renderers";
import { ClayButton, ClayInput, ClaySurface } from "@/components/ui/clay";
import {
  Layers,
  LayoutGrid,
  Calendar as CalendarIcon,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Edit3,
  Eye,
  Loader2,
  FolderOpen,
  Share2,
  X,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentSpace {
  id: string;
  shareId: string;
  workspaceId: string | null;
  token: string;
  workspaceName: string;
  title: string | null;
  scope: string;
  effectivePermission: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  itemCount: number;
  lastVisitedAt: string;
}

export default function SpacesCollectionPage() {
  const { user } = useAuth();
  const { workspaces, activeWorkspace, createWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [recentSpaces, setRecentSpaces] = React.useState<RecentSpace[]>([]);
  const [loadingRecent, setLoadingRecent] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create Workspace Modal State
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [newWsName, setNewWsName] = React.useState("");
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // User's owned workspace (if one exists)
  const ownedWorkspace: Workspace | null = React.useMemo(() => {
    return workspaces.find((w) => w.isOwner) || null;
  }, [workspaces]);

  // Load recently visited spaces
  const fetchRecentSpaces = React.useCallback(async () => {
    try {
      setLoadingRecent(true);
      const headers = await getAuthHeaders();
      const res = await fetch("/api/user/recent-spaces", { headers });
      if (res.ok) {
        const data = await res.json();
        setRecentSpaces(data.recentSpaces || []);
      }
    } catch (err) {
      console.error("[Spaces] Failed loading recent spaces:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRecentSpaces();
  }, [fetchRecentSpaces]);

  // Dismiss a space from recently visited
  const handleDismissRecent = async (e: React.MouseEvent, shareId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/user/recent-spaces?shareId=${encodeURIComponent(shareId)}`, {
        method: "DELETE",
        headers,
      });
      setRecentSpaces((prev) => prev.filter((s) => s.shareId !== shareId));
    } catch (err) {
      console.error("[Spaces] Failed dismissing space:", err);
    }
  };

  // Handle Create Workspace Submit
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newWsName.trim() || newWsName.trim().length < 2) {
      setCreateError("Workspace name must be at least 2 characters.");
      return;
    }

    setCreateLoading(true);
    try {
      await createWorkspace(newWsName.trim());
      setCreateModalOpen(false);
      setNewWsName("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create workspace.";
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Filter recently visited spaces
  const filteredRecentSpaces = React.useMemo(() => {
    if (!searchQuery.trim()) return recentSpaces;
    const q = searchQuery.toLowerCase().trim();
    return recentSpaces.filter(
      (s) =>
        s.workspaceName.toLowerCase().includes(q) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        s.ownerDisplayName.toLowerCase().includes(q)
    );
  }, [recentSpaces, searchQuery]);

  return (
    <div className="flex-1 w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 select-none animate-in fade-in-50 duration-200">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#EDE5D9]/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] flex items-center justify-center shadow-xs">
              <Compass className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#24211F] tracking-tight">
              Spaces Collection
            </h1>
          </div>
          <p className="text-xs text-[#817A72] mt-1">
            Access your owned shelf and all collaborative spaces shared with you.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#AAA197]" />
            <input
              type="text"
              placeholder="Search spaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs rounded-full border border-[#EDE5D9] bg-[#FFFEFA] text-[#24211F] placeholder:text-[#AAA197] focus:outline-none focus:border-[#F58B35]/60 shadow-[inset_0_1px_2px_rgba(36,33,31,0.03)]"
            />
          </div>

          {/* Create Workspace CTA (if user doesn't own one) */}
          {!ownedWorkspace && (
            <ClayButton
              variant="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Workspace</span>
            </ClayButton>
          )}
        </div>
      </div>

      {/* 2. My Workspace Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#24211F] uppercase tracking-wider">
              My Workspace
            </h2>
            <span className="text-[10px] font-semibold text-[#817A72] bg-[#F5EFE5] px-2 py-0.5 rounded-full">
              {ownedWorkspace ? "1 Owned Shelf" : "0 Owned"}
            </span>
          </div>
        </div>

        {ownedWorkspace ? (
          /* User owns a workspace */
          <div className="clay-card p-5 bg-[#FFFEFA] border border-[#EDE5D9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-[#DFD5C5] hover:shadow-[0_8px_24px_rgba(36,33,31,0.05)]">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#FFE4D0] to-[#FFD5BA] text-[#F58B35] flex items-center justify-center shrink-0 shadow-xs">
                <LayoutGrid className="h-6 w-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#24211F]">
                    {ownedWorkspace.name}
                  </h3>
                  <span className="text-[10px] font-bold text-[#F58B35] bg-[#FFE4D0] px-2 py-0.5 rounded-full">
                    Owner
                  </span>
                </div>
                <p className="text-xs text-[#817A72]">
                  Your personal clipboard board canvas with 7 content lanes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Link href="/calendar">
                <ClayButton variant="secondary" size="md">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Calendar</span>
                </ClayButton>
              </Link>
              <Link href="/">
                <ClayButton variant="primary" size="md">
                  <span>Open Board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </ClayButton>
              </Link>
            </div>
          </div>
        ) : (
          /* Inviting empty state for users without an owned workspace */
          <div className="clay-card p-6 sm:p-8 bg-gradient-to-b from-[#FFFDF9] to-[#FAF6EE] border border-dashed border-[#DDD5C7] rounded-3xl text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-[#FFE8D6] text-[#A65E26] flex items-center justify-center mx-auto shadow-2xs">
              <Layers className="h-6 w-6 stroke-[2]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-[#24211F]">
                You don&apos;t have a workspace yet.
              </h3>
              <p className="text-xs text-[#817A72] leading-relaxed">
                Your collaborators can still share their spaces with you. Create your own whenever you&apos;re ready.
              </p>
            </div>
            <ClayButton
              variant="peach"
              size="lg"
              onClick={() => setCreateModalOpen(true)}
              className="mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create My Workspace</span>
            </ClayButton>
          </div>
        )}
      </div>

      {/* 3. Recently Visited Spaces Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#24211F] uppercase tracking-wider">
              Recently Visited Spaces
            </h2>
            <span className="text-[10px] font-semibold text-[#817A72] bg-[#F5EFE5] px-2 py-0.5 rounded-full">
              {filteredRecentSpaces.length}
            </span>
          </div>
        </div>

        {loadingRecent ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center text-xs text-[#817A72]">
            <Loader2 className="h-5 w-5 animate-spin text-[#F58B35]" />
            <span>Loading recently visited spaces...</span>
          </div>
        ) : filteredRecentSpaces.length === 0 ? (
          <div className="clay-card p-8 bg-[#FFFEFA] border border-[#EDE5D9] rounded-2xl text-center space-y-2">
            <FolderOpen className="h-8 w-8 text-[#AAA197] mx-auto opacity-50" />
            <h4 className="text-xs font-bold text-[#24211F]">No recently visited spaces</h4>
            <p className="text-[11px] text-[#817A72] max-w-sm mx-auto">
              When collaborators share their Board or Calendar links with you, they will automatically appear here for one-click access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecentSpaces.map((space) => {
              const isEditor = space.effectivePermission === "editor";
              const scopeLabel =
                space.scope === "calendar"
                  ? "Calendar"
                  : space.scope === "workspace"
                  ? "Board + Calendar"
                  : space.scope === "selected_items"
                  ? "Selected Items"
                  : "Board";

              return (
                <div
                  key={space.shareId}
                  className="clay-card p-4 bg-[#FFFEFA] border border-[#EDE5D9] hover:border-[#DFD5C5] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(36,33,31,0.05)] rounded-2xl flex flex-col justify-between gap-3 group relative select-none"
                >
                  {/* Card Header: Owner and Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {space.ownerAvatarUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={space.ownerAvatarUrl}
                            alt={space.ownerDisplayName}
                            className="h-6 w-6 rounded-full object-cover border border-[#EDE5D9]"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-[#FFE8D6] text-[#A65E26] font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                            {space.ownerDisplayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-[#817A72] truncate">
                          {space.ownerDisplayName}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDismissRecent(e, space.shareId)}
                        title="Dismiss from recents"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-lg text-[#AAA197] hover:text-red-500 hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Space Title */}
                    <div>
                      <h4 className="text-sm font-bold text-[#24211F] leading-snug line-clamp-1">
                        {space.title || space.workspaceName}
                      </h4>
                      {space.title && (
                        <p className="text-[11px] text-[#817A72] truncate">
                          {space.workspaceName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badges: Scope, Permission, Relative Time */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F5EFE5] text-[#736B63] border border-[#EDE5D9]">
                      {scopeLabel}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                        isEditor
                          ? "bg-[#FFE4D0] text-[#F58B35] border-[#F5C6A3]"
                          : "bg-[#F5EFE5] text-[#736B63] border-[#EDE5D9]"
                      )}
                    >
                      {isEditor ? "Editor" : "Viewer"}
                    </span>
                    <span className="text-[10.5px] text-[#AAA197] ml-auto flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{getRelativeTimeString(space.lastVisitedAt)}</span>
                    </span>
                  </div>

                  {/* Card Action: Open Space Link */}
                  <div className="pt-2 border-t border-[#F5EFE5]">
                    <Link
                      href={`/s/${space.token}`}
                      className="w-full"
                    >
                      <ClayButton
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs gap-1.5"
                      >
                        <span>Open Space</span>
                        <ExternalLink className="h-3 w-3" />
                      </ClayButton>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Create Workspace Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-50">
          <div className="relative w-full max-w-md rounded-3xl bg-[#FFFEFA] border border-[#EDE5D9] p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#24211F]">
                <Sparkles className="h-4 w-4 text-[#F58B35]" />
                <span>Create Your Workspace</span>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="h-7 w-7 rounded-full text-[#817A72] hover:bg-[#F5EFE5] flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#817A72] leading-relaxed">
              Every account can own one personal workspace with its own Board Canvas and Calendar.
            </p>

            {createError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24211F]">
                  Workspace Name
                </label>
                <ClayInput
                  type="text"
                  placeholder="e.g. George's Workspace or Product Lab"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  disabled={createLoading}
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <ClayButton
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={createLoading}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </ClayButton>
                <ClayButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createLoading || !newWsName.trim()}
                  loading={createLoading}
                >
                  <span>Create Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </ClayButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
