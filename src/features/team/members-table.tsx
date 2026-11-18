"use client";

import * as React from "react";
import {
  Shield,
  Trash2,
  Loader2,
  Crown,
  User,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceMemberInfo } from "@/lib/validation/team";
import { getAuthHeaders } from "@/features/auth/auth-helpers";

interface MembersTableProps {
  workspaceId: string;
  members: WorkspaceMemberInfo[];
  isOwner: boolean;
  onMemberUpdated: (member: WorkspaceMemberInfo) => void;
  onMemberRemoved: (uid: string) => void;
}

export function MembersTable({
  workspaceId,
  members,
  isOwner,
  onMemberUpdated,
  onMemberRemoved,
}: MembersTableProps) {
  const [updatingUid, setUpdatingUid] = React.useState<string | null>(null);
  const [deletingUid, setDeletingUid] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRoleChange = async (uid: string, newRole: "editor" | "viewer") => {
    setUpdatingUid(uid);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${uid}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      const existing = members.find((m) => m.uid === uid);
      if (existing) {
        onMemberUpdated({
          ...existing,
          role: newRole,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to update member role");
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMemberInfo) => {
    if (!window.confirm(`Are you sure you want to remove ${member.displayName || member.email || "this member"} from the workspace?`)) {
      return;
    }

    setDeletingUid(member.uid);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.uid}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      onMemberRemoved(member.uid);
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    } finally {
      setDeletingUid(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/30 text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined Date</th>
              {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {members.map((member) => {
              const displayName = member.displayName || member.email?.split("@")[0] || "User";
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <tr key={member.uid} className="hover:bg-muted/10 transition-colors">
                  {/* Member identity */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                        {member.isOwner ? <Crown className="h-4 w-4 text-amber-500" /> : initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="truncate">{displayName}</span>
                          {member.isOwner && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Owner
                            </Badge>
                          )}
                        </div>
                        {member.email && (
                          <div className="text-[11px] text-muted-foreground truncate">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {member.isOwner ? (
                      <span className="text-xs font-semibold capitalize text-amber-600 dark:text-amber-400">
                        Owner
                      </span>
                    ) : isOwner ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={member.role}
                          disabled={updatingUid === member.uid}
                          onChange={(e) =>
                            handleRoleChange(member.uid, e.target.value as "editor" | "viewer")
                          }
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary capitalize"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {updatingUid === member.uid && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {member.role}
                      </Badge>
                    )}
                  </td>

                  {/* Joined Date */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </td>

                  {/* Actions for Owner */}
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      {!member.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={deletingUid === member.uid}
                          className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                          title="Remove member from workspace"
                        >
                          {deletingUid === member.uid ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">Remove</span>
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
