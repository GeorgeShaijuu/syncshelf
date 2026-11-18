"use client";

import * as React from "react";
import Link from "next/link";
import {
  Share2,
  Plus,
  Lock,
  Clock,
  ShieldCheck,
  Check,
  AlertTriangle,
  Layers,
  Trash2,
  Eye,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
  Globe,
  UserCheck,
  Mail,
  Edit2,
  Users,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Workspace } from "@/features/workspaces/workspace-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  getClientCachedData,
  setClientCachedData,
  invalidateClientCache,
} from "@/lib/cache/client-cache";
import {
  ShareScope,
  ShareAccessMode,
  SharePermission,
  ShareStatus,
} from "@/lib/validation/share";
import { CreateShareModal } from "./create-share-modal";
import { cn } from "@/lib/utils";

interface StoredShareSummary {
  id: string;
  scope: ShareScope;
  accessMode: ShareAccessMode;
  defaultPermission: SharePermission;
  allowPublicEditing: boolean;
  invitedRecipients: Array<{ email: string; permission: SharePermission; addedAt: string }>;
  title: string | null;
  itemIds: string[];
  itemCount: number;
  status: ShareStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  viewCount: number;
}

interface SharesDashboardViewProps {
  workspace: Workspace;
}

export function SharesDashboardView({ workspace }: SharesDashboardViewProps) {
  const isOwner = workspace.role === "owner";
  const [activeTab, setActiveTab] = React.useState<"active" | "recent" | "past">(
    isOwner ? "active" : "recent"
  );
  const cacheKey = `shares_${workspace.id}`;
  const initialCache = React.useMemo(() => {
    return getClientCachedData<StoredShareSummary[]>(cacheKey);
  }, [cacheKey]);

  const [shares, setShares] = React.useState<StoredShareSummary[]>(initialCache || []);
  const [recentShares, setRecentShares] = React.useState<
    Array<{
      id: string;
      shareId: string;
      token: string;
      workspaceName: string;
      title: string | null;
      scope: ShareScope;
      effectivePermission: SharePermission;
      visitedAt: string;
    }>
  >([]);
  const [loadingRecent, setLoadingRecent] = React.useState(false);
  const [loading, setLoading] = React.useState(!initialCache && isOwner);
  const [refreshing, setRefreshing] = React.useState(false);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Fetch recently viewed shares when tab is clicked
  React.useEffect(() => {
    if (activeTab !== "recent") return;

    let isMounted = true;
    async function fetchRecent() {
      setLoadingRecent(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/user/recent-shares", { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          setRecentShares(data.recentShares || []);
        }
      } catch (err) {
        console.error("Failed to fetch recent shares:", err);
      } finally {
        if (isMounted) setLoadingRecent(false);
      }
    }

    fetchRecent();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Manage / Edit modal state
  const [editingShare, setEditingShare] = React.useState<StoredShareSummary | null>(null);
  const [editDefaultPermission, setEditDefaultPermission] = React.useState<SharePermission>("viewer");
  const [editAllowPublicEditing, setEditAllowPublicEditing] = React.useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = React.useState("");
  const [newRecipientPermission, setNewRecipientPermission] = React.useState<SharePermission>("viewer");
  const [savingEdit, setSavingEdit] = React.useState(false);

  const fetchShares = React.useCallback(async (isManualRefresh = false) => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    if (!initialCache && shares.length === 0) {
      setLoading(true);
    }
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspace.id}/shares`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.shares || [];
        setShares(list);
        setClientCachedData(cacheKey, list);
      }
    } catch (err) {
      console.error("Failed to fetch shares:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspace.id, isOwner, cacheKey, initialCache, shares.length]);

  React.useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm("Are you sure you want to revoke this share link? Anyone with this URL will immediately lose access in real time.")) {
      return;
    }

    setRevokingId(shareId);
    setActionError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspace.id}/shares/${shareId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke share");
      }

      setShares((prev) =>
        prev.map((s) =>
          s.id === shareId
            ? { ...s, status: "revoked", revokedAt: new Date().toISOString() }
            : s
        )
      );
      invalidateClientCache(cacheKey);
    } catch (err: any) {
      setActionError(err.message || "Failed to revoke share link");
    } finally {
      setRevokingId(null);
    }
  };

  const handleOpenEdit = (share: StoredShareSummary) => {
    setEditingShare(share);
    setEditDefaultPermission(share.defaultPermission || "viewer");
    setEditAllowPublicEditing(!!share.allowPublicEditing);
    setNewRecipientEmail("");
    setNewRecipientPermission("viewer");
  };

  const handleSaveEdit = async () => {
    if (!editingShare) return;
    setSavingEdit(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/workspaces/${workspace.id}/shares/${editingShare.id}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            defaultPermission: editDefaultPermission,
            allowPublicEditing: editAllowPublicEditing,
            invitedRecipients: editingShare.invitedRecipients,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update share");
      }

      const updated = await res.json();
      setShares((prev) =>
        prev.map((s) => (s.id === editingShare.id ? { ...s, ...updated } : s))
      );
      invalidateClientCache(cacheKey);
      setEditingShare(null);
    } catch (err: any) {
      alert(err.message || "Failed to update share");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddRecipientInEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShare) return;
    const email = newRecipientEmail.trim().toLowerCase();
    if (!email) return;

    if (editingShare.invitedRecipients.some((r) => r.email === email)) {
      alert("This email is already added");
      return;
    }

    setEditingShare({
      ...editingShare,
      invitedRecipients: [
        ...editingShare.invitedRecipients,
        {
          email,
          permission: newRecipientPermission,
          addedAt: new Date().toISOString(),
        },
      ],
    });
    setNewRecipientEmail("");
  };

  const handleRemoveRecipientInEdit = (emailToRemove: string) => {
    if (!editingShare) return;
    setEditingShare({
      ...editingShare,
      invitedRecipients: editingShare.invitedRecipients.filter(
        (r) => r.email !== emailToRemove
      ),
    });
  };

  const activeShares = shares.filter((s) => s.status === "active");
  const pastShares = shares.filter((s) => s.status === "revoked" || s.status === "expired");

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
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

  const getScopeBadge = (scope: ShareScope, count: number) => {
    switch (scope) {
      case "board":
        return { label: "Board Canvas", icon: Layers };
      case "calendar":
        return { label: "Calendar", icon: Calendar };
      case "workspace":
        return { label: "Both Views", icon: Sparkles };
      case "item":
        return { label: "1 Clip", icon: Share2 };
      default:
        return { label: `${count} Clips`, icon: Share2 };
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#EDE5D9] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#24211F]">Workspace Sharing 2.0</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFE4D0] text-[#F58B35] border border-[#F5C6A3]">
              Live Collaborative
            </span>
          </div>
          <p className="text-xs text-[#817A72] mt-0.5">
            Share complete board canvases, interactive calendars, or selected clips with granular permissions.
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                fetchShares(true);
              }}
              disabled={refreshing}
              className="clay-btn-secondary h-8 px-2.5 text-xs text-[#817A72] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#F58B35]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="clay-btn-primary flex items-center gap-1.5 h-8 px-4 text-xs font-bold active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Share Content</span>
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#EDE5D9]/80">
          {isOwner && (
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "active"
                  ? "border-[#F58B35] text-[#F58B35]"
                  : "border-transparent text-[#817A72] hover:text-[#24211F]"
              }`}
            >
              <span>Active Shares</span>
              <span className="rounded-full bg-[#FFE4D0] text-[#F58B35] px-1.5 py-0.2 text-[10px] font-bold">
                {activeShares.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("recent")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "recent"
                ? "border-[#F58B35] text-[#F58B35]"
                : "border-transparent text-[#817A72] hover:text-[#24211F]"
            }`}
          >
            <span>Recently Viewed</span>
            <span className="rounded-full bg-[#FFE4D0] text-[#F58B35] px-1.5 py-0.2 text-[10px] font-bold">
              {recentShares.length}
            </span>
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab("past")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "past"
                  ? "border-[#F58B35] text-[#F58B35]"
                  : "border-transparent text-[#817A72] hover:text-[#24211F]"
              }`}
            >
              <span>Past Shares</span>
              <span className="rounded-full bg-[#F5EFE5] text-[#817A72] px-1.5 py-0.2 text-[10px] font-bold">
                {pastShares.length}
              </span>
            </button>
          )}
        </div>

        {activeTab === "recent" ? (
          /* Recently Viewed Tab */
          loadingRecent ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-[#817A72]">
              <Loader2 className="h-6 w-6 animate-spin text-[#F58B35]" />
              <span>Loading recently viewed shares...</span>
            </div>
          ) : recentShares.length === 0 ? (
            <div className="clay-card border-dashed border-[#DDD5C7] p-12 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-[#FFE4D0] text-[#F58B35] flex items-center justify-center mx-auto shadow-xs">
                <Clock className="h-5 w-5 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#24211F]">No Recently Viewed Shares</h3>
                <p className="text-xs text-[#817A72] max-w-sm mx-auto">
                  When you visit shared boards, calendars, or clips shared with you, they will appear here for quick access.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentShares.map((recent) => (
                <div key={recent.id} className="clay-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold capitalize bg-[#FFE4D0] text-[#F58B35] px-2 py-0.5 rounded-full border border-[#F5C6A3]">
                      {recent.title || recent.scope.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-bold capitalize bg-[#F5EFE5] text-[#524B43] px-2 py-0.5 rounded-full">
                      {recent.effectivePermission}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{recent.workspaceName}</p>
                    <p>Last visited: {formatDate(recent.visitedAt)}</p>
                  </div>

                  <div className="pt-2 border-t border-[#EDE5D9] flex items-center justify-end">
                    <Link href={`/s/${recent.token}`}>
                      <Button size="sm" className="h-7 text-xs px-3 rounded-lg bg-[#F58B35] text-white gap-1">
                        <span>Open Workspace</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : !isOwner ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center max-w-lg mx-auto shadow-sm space-y-3">
            <Lock className="h-6 w-6 text-primary mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">Owner Authorization Required</h3>
            <p className="text-xs text-muted-foreground">
              Only workspace owners can manage shared links for this workspace.
            </p>
          </div>
        ) : loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-[#817A72]">
            <Loader2 className="h-6 w-6 animate-spin text-[#F58B35]" />
            <span>Loading shared links...</span>
          </div>
        ) : activeTab === "active" ? (
            activeShares.length === 0 ? (
              <div className="clay-card border-dashed border-[#DDD5C7] p-12 text-center space-y-3">
                <div className="h-10 w-10 rounded-full bg-[#FFE4D0] text-[#F58B35] flex items-center justify-center mx-auto shadow-xs">
                  <Share2 className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#24211F]">No Active Share Links</h3>
                  <p className="text-xs text-[#817A72] max-w-sm mx-auto">
                    You haven&apos;t generated any sharing links yet. Share your Board Canvas, Calendar, or individual snippets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="clay-btn-primary h-8 px-4 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Share Content</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeShares.map((share) => {
                  const scopeInfo = getScopeBadge(share.scope, share.itemCount);
                  const ScopeIcon = scopeInfo.icon;
                  return (
                    <div
                      key={share.id}
                      className="clay-card p-4 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold capitalize bg-[#FFE4D0] text-[#F58B35] px-2 py-0.5 rounded-full border border-[#F5C6A3] flex items-center gap-1">
                            <ScopeIcon className="h-3 w-3" />
                            <span>{share.title || scopeInfo.label}</span>
                          </span>

                          <span className="text-[10px] font-bold capitalize bg-[#F5EFE5] text-[#524B43] px-2 py-0.5 rounded-full border border-[#EDE5D9] flex items-center gap-1">
                            {share.accessMode === "public" ? (
                              <>
                                <Globe className="h-2.5 w-2.5 text-[#F58B35]" />
                                <span>Public</span>
                              </>
                            ) : share.accessMode === "authenticated" ? (
                              <>
                                <UserCheck className="h-2.5 w-2.5 text-blue-500" />
                                <span>Signed-in</span>
                              </>
                            ) : (
                              <>
                                <Mail className="h-2.5 w-2.5 text-purple-500" />
                                <span>{share.invitedRecipients?.length || 0} People</span>
                              </>
                            )}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3 w-3 text-muted-foreground" /> Permission:
                          </span>
                          <span className="font-semibold text-foreground capitalize">
                            {share.accessMode === "public" && share.allowPublicEditing
                              ? "Public Editors"
                              : share.defaultPermission || "Viewer"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" /> Created:
                          </span>
                          <span className="font-medium text-foreground">{formatDate(share.createdAt)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" /> Expires:
                          </span>
                          <span className={`font-medium ${share.expiresAt ? "text-amber-500" : "text-foreground"}`}>
                            {formatDate(share.expiresAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Eye className="h-3 w-3 text-muted-foreground" /> Views:
                          </span>
                          <span className="font-mono text-foreground">{share.viewCount}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#EDE5D9] flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(share)}
                          className="h-7 text-xs px-2.5 rounded-lg border-[#EDE5D9] hover:bg-[#F5EFE5] text-[#524B43]"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          <span>Manage</span>
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeShare(share.id)}
                          disabled={revokingId === share.id}
                          className="h-7 text-xs px-2.5 rounded-lg"
                        >
                          {revokingId === share.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              <span>Revoke</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Past Shares Tab */
            pastShares.length === 0 ? (
              <div className="clay-card border-dashed border-[#DDD5C7] p-8 text-center text-xs text-[#817A72]">
                No revoked or expired shares.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 opacity-80">
                {pastShares.map((share) => (
                  <div key={share.id} className="clay-card p-4 space-y-2 border-[#DDD5C7]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold capitalize bg-[#F5EFE5] text-[#524B43] px-2 py-0.5 rounded-full">
                        {share.title || share.scope.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full capitalize">
                        {share.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Created: {formatDate(share.createdAt)}</p>
                      {share.revokedAt && <p>Revoked: {formatDate(share.revokedAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      {/* Edit / Manage Modal */}
      {editingShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setEditingShare(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EDE5D9] pb-3">
              <h3 className="text-base font-bold text-[#24211F]">
                Manage Share Settings
              </h3>
              <button
                onClick={() => setEditingShare(null)}
                className="text-[#736B63] hover:text-[#24211F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {editingShare.accessMode === "public" && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#24211F]">Allow signed-in visitors to edit</span>
                    <p className="text-[11px] text-[#736B63]">
                      Anonymous visitors will remain Viewers.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editAllowPublicEditing}
                    onChange={(e) => setEditAllowPublicEditing(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#F58B35] cursor-pointer"
                  />
                </div>
              )}

              {editingShare.accessMode === "authenticated" && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] flex items-center justify-between">
                  <span className="font-semibold text-[#24211F]">Default Role:</span>
                  <div className="flex gap-1.5 bg-[#F5EFE5] p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditDefaultPermission("viewer")}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md font-medium",
                        editDefaultPermission === "viewer"
                          ? "bg-white text-[#24211F] shadow-xs"
                          : "text-[#736B63]"
                      )}
                    >
                      Viewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDefaultPermission("editor")}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md font-medium",
                        editDefaultPermission === "editor"
                          ? "bg-[#F58B35] text-white shadow-xs"
                          : "text-[#736B63]"
                      )}
                    >
                      Editor
                    </button>
                  </div>
                </div>
              )}

              {editingShare.accessMode === "specific_people" && (
                <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] space-y-3">
                  <label className="font-semibold text-[#24211F]">Invited Recipients</label>
                  <form onSubmit={handleAddRecipientInEdit} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={newRecipientEmail}
                      onChange={(e) => setNewRecipientEmail(e.target.value)}
                      className="text-xs h-8 bg-white border-[#EDE5D9] rounded-xl flex-1"
                    />
                    <select
                      value={newRecipientPermission}
                      onChange={(e) =>
                        setNewRecipientPermission(e.target.value as SharePermission)
                      }
                      className="text-xs h-8 bg-white border border-[#EDE5D9] rounded-xl px-2"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <Button
                      type="submit"
                      className="h-8 px-2.5 bg-[#F58B35] text-white text-xs rounded-xl"
                    >
                      Add
                    </Button>
                  </form>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {editingShare.invitedRecipients.map((r) => (
                      <div
                        key={r.email}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-[#EDE5D9]"
                      >
                        <span className="font-medium text-[#24211F]">{r.email}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5EFE5] text-[#524B43] uppercase">
                            {r.permission}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipientInEdit(r.email)}
                            className="text-[#736B63] hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDE5D9]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingShare(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="bg-[#F58B35] text-white hover:bg-[#E07928] text-xs h-8 px-4"
              >
                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Share Creation Modal */}
      <CreateShareModal
        isOpen={createModalOpen}
        workspaceId={workspace.id}
        onClose={() => setCreateModalOpen(false)}
        onShareCreated={() => {
          fetchShares(true);
        }}
      />
    </div>
  );
}
