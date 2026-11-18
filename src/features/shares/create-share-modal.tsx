"use client";

import * as React from "react";
import {
  Share2,
  X,
  Plus,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Search,
  FileText,
  Code2,
  Link2,
  Image as ImageIcon,
  Music,
  Video,
  FileBox,
  Loader2,
  Globe,
  UserCheck,
  Mail,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  ShareScope,
  ShareAccessMode,
  SharePermission,
  ShareExpiryOption,
} from "@/lib/validation/share";
import { cn } from "@/lib/utils";

interface WorkspaceItemSummary {
  id: string;
  type: string;
  title: string;
  content?: string;
  url?: string;
  fileName?: string;
  createdAt: string;
}

interface CreateShareModalProps {
  isOpen: boolean;
  workspaceId: string;
  preselectedItemId?: string;
  preselectedItemIds?: string[];
  onClose: () => void;
  onShareCreated: () => void;
}

export function CreateShareModal({
  isOpen,
  workspaceId,
  preselectedItemId,
  preselectedItemIds,
  onClose,
  onShareCreated,
}: CreateShareModalProps) {
  const hasPreselected = Boolean(
    (preselectedItemIds && preselectedItemIds.length > 0) || preselectedItemId
  );

  const [scope, setScope] = React.useState<ShareScope>(
    hasPreselected ? "selected_items" : "board"
  );
  const [accessMode, setAccessMode] = React.useState<ShareAccessMode>("public");
  const [defaultPermission, setDefaultPermission] = React.useState<SharePermission>("viewer");
  const [allowPublicEditing, setAllowPublicEditing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [expiry, setExpiry] = React.useState<ShareExpiryOption>("7d");

  // Specific people invite list
  const [invitedRecipients, setInvitedRecipients] = React.useState<
    Array<{ email: string; permission: SharePermission }>
  >([]);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [recipientPermission, setRecipientPermission] = React.useState<SharePermission>("viewer");
  const [recipientError, setRecipientError] = React.useState<string | null>(null);

  // Selected item IDs for scope = "selected_items"
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>(
    preselectedItemIds && preselectedItemIds.length > 0
      ? preselectedItemIds
      : preselectedItemId
      ? [preselectedItemId]
      : []
  );

  const [items, setItems] = React.useState<WorkspaceItemSummary[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Result state after creation
  const [createdShare, setCreatedShare] = React.useState<{
    id: string;
    token: string;
    url: string;
    scope: string;
    accessMode: string;
    expiresAt: string | null;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (preselectedItemId) {
      setSelectedItemIds([preselectedItemId]);
      setScope("selected_items");
    } else if (preselectedItemIds && preselectedItemIds.length > 0) {
      setSelectedItemIds(preselectedItemIds);
      setScope("selected_items");
    }
  }, [preselectedItemId, preselectedItemIds]);

  // Fetch items if selected_items is used
  React.useEffect(() => {
    if (!isOpen || scope !== "selected_items") return;

    let isMounted = true;
    async function fetchItems() {
      setLoadingItems(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/workspaces/${workspaceId}/items?limit=50`, {
          headers,
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error("Failed to load workspace items for sharing:", err);
      } finally {
        if (isMounted) setLoadingItems(false);
      }
    }

    fetchItems();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId, scope]);

  if (!isOpen) return null;

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    setRecipientError(null);

    const email = recipientEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setRecipientError("Please enter a valid email address");
      return;
    }

    if (invitedRecipients.some((r) => r.email === email)) {
      setRecipientError("This email is already on the invite list");
      return;
    }

    setInvitedRecipients((prev) => [
      ...prev,
      { email, permission: recipientPermission },
    ]);
    setRecipientEmail("");
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setInvitedRecipients((prev) =>
      prev.filter((r) => r.email !== emailToRemove)
    );
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 50) {
        setError("You can select up to 50 items for a single share link.");
        return prev;
      }
      setError(null);
      return [...prev, id];
    });
  };

  const handleCreateShare = async () => {
    if (scope === "selected_items" && selectedItemIds.length === 0) {
      setError("Please select at least one clipboard item to share.");
      return;
    }

    if (accessMode === "specific_people" && invitedRecipients.length === 0) {
      setError("Please invite at least one person with an email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/shares`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope,
          accessMode,
          defaultPermission,
          allowPublicEditing,
          invitedRecipients,
          itemIds: scope === "selected_items" ? selectedItemIds : undefined,
          expiry,
          title: title.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create share link");
      }

      setCreatedShare(data);
      onShareCreated();
    } catch (err: any) {
      setError(err.message || "Failed to generate share link");
    } finally {
      setSubmitting(false);
    }
  };

  const copyShareUrl = () => {
    if (!createdShare?.url) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(createdShare.url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const filteredItems = items.filter((it) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      it.title?.toLowerCase().includes(q) ||
      it.content?.toLowerCase().includes(q) ||
      it.fileName?.toLowerCase().includes(q)
    );
  });

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] p-6 shadow-xl space-y-6 my-8 animate-in fade-in-50 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EDE5D9] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFE4D0] text-[#F58B35] shadow-xs">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#24211F] tracking-tight">
                Share Workspace Content
              </h2>
              <p className="text-xs text-[#736B63]">
                Collaborative sharing with granular audience and permission controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[#736B63] hover:bg-[#F5EFE5] hover:text-[#24211F] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdShare ? (
          /* Success Screen */
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Check className="h-5 w-5" />
                <span>Share Link Generated Successfully</span>
              </div>
              <p className="text-xs text-[#524B43] leading-relaxed">
                Your collaborative link is ready. Anyone with authorized access can visit it directly.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="capitalize text-[11px] bg-white border-emerald-300">
                  Scope: {createdShare.scope.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="capitalize text-[11px] bg-white border-emerald-300">
                  Access: {createdShare.accessMode.replace("_", " ")}
                </Badge>
                {createdShare.expiresAt && (
                  <Badge variant="outline" className="text-[11px] bg-white border-emerald-300">
                    Expires: {new Date(createdShare.expiresAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#524B43]">Share URL</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdShare.url}
                  className="font-mono text-xs bg-[#FAF7F0] border-[#EDE5D9] select-all h-10 rounded-xl"
                />
                <Button
                  onClick={copyShareUrl}
                  className={cn(
                    "shrink-0 h-10 px-4 rounded-xl gap-2 font-medium shadow-xs transition-all",
                    copied
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-[#F58B35] text-white hover:bg-[#E07928]"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-xl border-[#EDE5D9] hover:bg-[#F5EFE5] text-xs h-9 px-5"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Creation Form */
          <div className="space-y-6">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* 1. Scope Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[#24211F] uppercase tracking-wider">
                1. What do you want to share?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    id: "board",
                    label: "Board Canvas",
                    desc: "7 lanes & previews",
                    icon: Layers,
                  },
                  {
                    id: "calendar",
                    label: "Calendar",
                    desc: "Dates & views",
                    icon: Calendar,
                  },
                  {
                    id: "workspace",
                    label: "Both Views",
                    desc: "Board + Calendar",
                    icon: Sparkles,
                  },
                  {
                    id: "selected_items",
                    label: "Selected Items",
                    desc: "Handpicked clips",
                    icon: FileText,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = scope === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScope(item.id as ShareScope)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5",
                        isSelected
                          ? "border-[#F58B35] bg-[#FFE4D0]/30 shadow-xs ring-1 ring-[#F58B35]"
                          : "border-[#EDE5D9] bg-[#FAF7F0] hover:bg-[#F5EFE5]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isSelected ? "text-[#F58B35]" : "text-[#736B63]"
                          )}
                        />
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-[#F58B35]" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#24211F]">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-[#736B63]">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Access Audience Mode */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[#24211F] uppercase tracking-wider">
                2. Who can access this link?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: "public",
                    label: "Anyone with the link",
                    desc: "No login needed to view",
                    icon: Globe,
                  },
                  {
                    id: "authenticated",
                    label: "Signed-in users",
                    desc: "Requires SyncShelf account",
                    icon: UserCheck,
                  },
                  {
                    id: "specific_people",
                    label: "Specific people",
                    desc: "Only invited email addresses",
                    icon: Mail,
                  },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = accessMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setAccessMode(mode.id as ShareAccessMode)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5",
                        isSelected
                          ? "border-[#F58B35] bg-[#FFE4D0]/30 shadow-xs ring-1 ring-[#F58B35]"
                          : "border-[#EDE5D9] bg-[#FAF7F0] hover:bg-[#F5EFE5]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isSelected ? "text-[#F58B35]" : "text-[#736B63]"
                          )}
                        />
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-[#F58B35]" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#24211F]">
                        {mode.label}
                      </span>
                      <span className="text-[10px] text-[#736B63]">
                        {mode.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Conditional Options based on Access Mode */}
              {accessMode === "public" && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-[#24211F]">
                      Allow signed-in visitors to edit
                    </span>
                    <p className="text-[11px] text-[#736B63]">
                      Anonymous visitors will always remain Viewers. Only logged-in users with the link can edit.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowPublicEditing}
                    onChange={(e) => setAllowPublicEditing(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#F58B35] cursor-pointer"
                  />
                </div>
              )}

              {accessMode === "authenticated" && (
                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-[#24211F]">
                      Default role for signed-in users
                    </span>
                    <p className="text-[11px] text-[#736B63]">
                      Choose whether authenticated visitors can edit or only view
                    </p>
                  </div>
                  <div className="flex gap-1.5 bg-[#F5EFE5] p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDefaultPermission("viewer")}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                        defaultPermission === "viewer"
                          ? "bg-white text-[#24211F] shadow-xs"
                          : "text-[#736B63] hover:text-[#24211F]"
                      )}
                    >
                      Viewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultPermission("editor")}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                        defaultPermission === "editor"
                          ? "bg-[#F58B35] text-white shadow-xs"
                          : "text-[#736B63] hover:text-[#24211F]"
                      )}
                    >
                      Editor
                    </button>
                  </div>
                </div>
              )}

              {accessMode === "specific_people" && (
                <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#EDE5D9] space-y-3">
                  <form onSubmit={handleAddRecipient} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="text-xs h-9 bg-white border-[#EDE5D9] rounded-xl flex-1"
                    />
                    <select
                      value={recipientPermission}
                      onChange={(e) =>
                        setRecipientPermission(e.target.value as SharePermission)
                      }
                      className="text-xs h-9 bg-white border border-[#EDE5D9] rounded-xl px-2.5 text-[#24211F]"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <Button
                      type="submit"
                      className="h-9 px-3 bg-[#F58B35] text-white hover:bg-[#E07928] rounded-xl text-xs gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </Button>
                  </form>

                  {recipientError && (
                    <p className="text-[11px] text-destructive">{recipientError}</p>
                  )}

                  {invitedRecipients.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {invitedRecipients.map((r) => (
                        <div
                          key={r.email}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-[#EDE5D9] text-xs"
                        >
                          <span className="font-medium text-[#24211F]">{r.email}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5EFE5] text-[#524B43] uppercase">
                              {r.permission}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(r.email)}
                              className="text-[#736B63] hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#736B63]">
                      No recipients added yet. Add at least one email address.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 3. Items Selection (only if scope === "selected_items") */}
            {scope === "selected_items" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#24211F] uppercase tracking-wider">
                    3. Select items to share ({selectedItemIds.length} selected)
                  </label>
                  <span className="text-[11px] text-[#736B63]">Max 50 items</span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#736B63]" />
                  <Input
                    placeholder="Filter clips..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8 bg-[#FAF7F0] border-[#EDE5D9] rounded-xl"
                  />
                </div>

                {loadingItems ? (
                  <div className="flex items-center justify-center p-6 text-xs text-[#736B63] gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#F58B35]" />
                    <span>Loading clips...</span>
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-xs text-[#736B63] p-4 text-center">
                    No items in this workspace.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#EDE5D9] rounded-xl p-2 bg-[#FAF7F0]">
                    {filteredItems.map((item) => {
                      const Icon = getItemIcon(item.type);
                      const isSelected = selectedItemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItemSelection(item.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                            isSelected
                              ? "bg-[#FFE4D0]/50 border border-[#F58B35]/40 text-[#24211F]"
                              : "hover:bg-white text-[#524B43]"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-[#F58B35]" />
                            <span className="truncate font-medium">
                              {item.title || item.fileName || "Untitled"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-[#736B63] capitalize">
                              {item.type}
                            </span>
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center",
                                isSelected
                                  ? "bg-[#F58B35] border-[#F58B35] text-white"
                                  : "border-[#EDE5D9] bg-white"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. Link Expiration & Options */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#24211F] uppercase tracking-wider">
                {scope === "selected_items" ? "4" : "3"}. Link Settings
              </label>

              <div className="space-y-2">
                <Input
                  placeholder="Optional title (e.g. Design Assets Review)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs h-9 bg-[#FAF7F0] border-[#EDE5D9] rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#524B43]">Expiration</span>
                <div className="flex flex-wrap gap-2">
                  {(["1h", "24h", "7d", "30d", "never"] as ShareExpiryOption[]).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setExpiry(opt)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                          expiry === opt
                            ? "bg-[#F58B35] text-white border-[#F58B35] shadow-xs"
                            : "bg-[#FAF7F0] border-[#EDE5D9] text-[#736B63] hover:bg-[#F5EFE5]"
                        )}
                      >
                        {opt === "never" ? "Never expires" : opt}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDE5D9]">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-xl border-[#EDE5D9] hover:bg-[#F5EFE5] text-xs h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateShare}
                disabled={submitting}
                className="rounded-xl bg-[#F58B35] text-white hover:bg-[#E07928] text-xs h-9 px-5 font-semibold gap-1.5 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Link...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    <span>Create Share Link</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
