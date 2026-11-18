"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Shield,
  Users,
  HardDrive,
  Copy,
  Check,
  Calendar,
  User,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileCheck,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Workspace, useWorkspace } from "@/features/workspaces/workspace-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  getClientCachedData,
  setClientCachedData,
  invalidateClientCache,
} from "@/lib/cache/client-cache";

interface WorkspaceSettingsViewProps {
  workspace: Workspace;
}

interface WorkspaceDetailsResponse {
  id: string;
  name: string;
  ownerUid: string;
  memberCount: number;
  role: "owner" | "editor" | "viewer";
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  pendingInvitesCount?: number;
  storage: {
    isConfigured: boolean;
    provider: string;
    bucketName: string;
    maxUploadSizeBytes: number;
    maxUploadSizeLabel: string;
    supportedCategories: string[];
  };
}

export function WorkspaceSettingsView({ workspace }: WorkspaceSettingsViewProps) {
  const { updateWorkspaceInState } = useWorkspace();
  const cacheKey = `settings_${workspace.id}`;
  const initialCache = React.useMemo(() => {
    return getClientCachedData<WorkspaceDetailsResponse>(cacheKey);
  }, [cacheKey]);

  const [details, setDetails] = React.useState<WorkspaceDetailsResponse | null>(
    initialCache
  );
  const [loading, setLoading] = React.useState(!initialCache);
  const [error, setError] = React.useState<string | null>(null);

  // Rename states
  const [nameInput, setNameInput] = React.useState(
    initialCache?.name || workspace.name
  );
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameSuccess, setRenameSuccess] = React.useState(false);
  const [renameError, setRenameError] = React.useState<string | null>(null);

  // Copy ID state
  const [copiedId, setCopiedId] = React.useState(false);

  const isOwner = workspace.role === "owner";

  const fetchDetails = React.useCallback(async () => {
    if (!initialCache && !details) {
      setLoading(true);
    }
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspace.id}`, { headers });
      if (res.ok) {
        const data: WorkspaceDetailsResponse = await res.json();
        setDetails(data);
        setNameInput(data.name);
        setClientCachedData(cacheKey, data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Failed to fetch workspace details");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading workspace settings");
    } finally {
      setLoading(false);
    }
  }, [workspace.id, cacheKey, initialCache, details]);

  React.useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Handle Workspace Rename
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setRenameError("Workspace name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setRenameError("Workspace name must not exceed 50 characters.");
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    setRenameSuccess(false);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update workspace name.");
      }

      // Update local state and context
      updateWorkspaceInState(workspace.id, { name: trimmed });
      setDetails((prev) => (prev ? { ...prev, name: trimmed } : null));
      setRenameSuccess(true);
      setTimeout(() => setRenameSuccess(false), 3000);
    } catch (err: any) {
      setRenameError(err.message || "Failed to update workspace name.");
    } finally {
      setIsRenaming(false);
    }
  };

  const copyWorkspaceId = () => {
    navigator.clipboard.writeText(workspace.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading && !details) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Loading workspace settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl pb-12">
      {/* Page Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-primary" />
            <span>Workspace Settings</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage workspace preferences, storage infrastructure, team roles, and security policies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono capitalize px-2.5 py-0.5">
            Role: <span className="font-semibold text-primary ml-1">{workspace.role}</span>
          </Badge>
          {isOwner && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[11px]">
              Owner Account
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. General Settings */}
      <section className="clay-card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#EDE5D9]/70 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#F58B35]" />
            <h2 className="text-base font-bold text-[#24211F]">General Settings</h2>
          </div>
          <span className="text-[11px] text-[#817A72]">Canonical workspace record</span>
        </div>

        <form onSubmit={handleRename} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24211F] flex items-center justify-between">
              <span>Workspace Name</span>
              {!isOwner && (
                <span className="text-[10px] text-[#817A72]">
                  (Read-only for {workspace.role}s)
                </span>
              )}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={!isOwner || isRenaming}
                maxLength={50}
                placeholder="e.g. Acme Engineering Shelf"
                className="clay-inset max-w-md text-xs h-9 px-3.5 rounded-xl text-[#24211F] focus:outline-none focus:bg-[#FFFEFA]"
              />
              {isOwner && (
                <button
                  type="submit"
                  disabled={isRenaming || nameInput.trim() === workspace.name || nameInput.trim().length < 2}
                  className="clay-btn-primary h-9 px-4 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isRenaming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Name"
                  )}
                </button>
              )}
            </div>
            {renameSuccess && (
              <p className="text-[11px] text-emerald-600 font-semibold animate-in fade-in flex items-center gap-1 mt-1">
                <Check className="h-3.5 w-3.5" /> Workspace name updated successfully.
              </p>
            )}
            {renameError && (
              <p className="text-[11px] text-[#EE624E] font-medium animate-in fade-in flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" /> {renameError}
              </p>
            )}
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Workspace ID */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace ID
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-foreground truncate select-all" title={workspace.id}>
                {workspace.id}
              </span>
              <button
                type="button"
                onClick={copyWorkspaceId}
                title="Copy Workspace ID"
                aria-label="Copy Workspace ID"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                {copiedId ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Owner UID */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary" /> Workspace Owner
            </div>
            <div className="text-xs font-mono text-foreground truncate select-all" title={workspace.ownerUid}>
              {workspace.ownerUid}
            </div>
          </div>

          {/* Created Date */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" /> Created On
            </div>
            <div className="text-xs text-foreground font-medium">
              {details?.createdAt ? new Date(details.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              }) : "Recent"}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Team Members & Roles Overview */}
      <section className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Team & Roles</h2>
          </div>
          <Link
            href="/members"
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <span>Open Members Page</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/20 border border-border/60">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {details?.memberCount || workspace.memberCount || 1} Active Workspace Member{((details?.memberCount || workspace.memberCount) !== 1) ? "s" : ""}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Access is partitioned strictly by workspace ID with zero cross-workspace data bleed.
            </p>
          </div>
          <Link href="/members">
            <Button size="sm" variant="outline" className="text-xs font-medium shrink-0">
              Manage Members
            </Button>
          </Link>
        </div>

        {/* Roles & Permissions Reference */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Permission Hierarchy</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border border-border/60 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Owner</span>
                <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Full Control</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Invite team members, assign Editor/Viewer roles, manage membership, revoke invitations, audit logs, and rename workspace. Cannot be demoted or removed.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-border/60 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Editor</span>
                <Badge variant="outline" className="text-[10px]">Read & Write</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Create, edit, pin, upload files up to 25 MB, and delete clipboard items. Cannot invite members, change roles, or view administrative audit history.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-border/60 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Viewer</span>
                <Badge variant="outline" className="text-[10px]">Read Only</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Read-only access to all clipboard items and files. Can view member list. Cannot create, edit, delete items, or upload files.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Invitations Overview */}
      <section className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Invitations Policy</h2>
          </div>
          {isOwner && (
            <Link
              href="/members?tab=invites"
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <span>Manage Invites</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/20 border border-border/60 space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-primary" /> Cryptographic Token Security
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Every invitation link generates a 32-byte cryptographically secure random token (256 bits of entropy). Only the SHA-256 hash is persisted in Firestore; raw tokens are never saved or logged.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/20 border border-border/60 space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Expiration & Anti-Replay
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Invitations expire after 1 to 30 days (default: 7 days). Invitations are single-use; once accepted, atomic Firestore transactions prevent replay attacks and duplicate memberships.
            </p>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10 text-xs">
            <span className="text-muted-foreground">
              Pending Active Invitations:{" "}
              <strong className="text-foreground font-mono">
                {details?.pendingInvitesCount ?? 0}
              </strong>
            </span>
            <Link href="/members?tab=invites">
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                View & Revoke
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* 4. File Storage */}
      <section className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">File Storage</h2>
          </div>
          <Badge
            variant={details?.storage.isConfigured ? "outline" : "destructive"}
            className="text-[10px] tracking-wider uppercase font-mono px-2 py-0.5"
          >
            {details?.storage.isConfigured ? "Active" : "Unconfigured"}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3.5 rounded-lg bg-muted/20 border border-border/60 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span>Private Encrypted Storage</span>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-muted-foreground text-[11px]">
                End-to-end authorized uploads and short-lived temporary download links
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-foreground text-sm font-mono">
                {details?.storage.maxUploadSizeLabel || "25 MB"}
              </div>
              <div className="text-[10px] text-muted-foreground">Max upload per file</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5">
              <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-primary" /> Supported Types
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Images: PNG, JPEG, GIF, WebP, SVG</li>
                <li>Audio: MP3, WAV, OGG, WebM, FLAC</li>
                <li>Video: MP4, WebM, QuickTime, MKV</li>
                <li>Documents & Files: PDF, TXT, MD, CSV, JSON, ZIP</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5">
              <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" /> Privacy & Access Guarantee
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Zero public storage access. Files are only accessible to authorized workspace members via temporary signed links that expire automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Safety & Architecture Notice */}
      <section className="rounded-xl border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground space-y-1.5">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary" /> Workspace Access Rules
        </div>
        <p className="text-[11px] leading-relaxed">
          SyncShelf enforces single-workspace ownership where each account owns one workspace. Workspace deletion and ownership transfers are restricted to protect shared team content and audit records.
        </p>
      </section>
    </div>
  );
}
