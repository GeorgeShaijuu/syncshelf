"use client";

import * as React from "react";
import { Clock, Shield, Trash2, Mail, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicWorkspaceInvite } from "@/lib/validation/team";
import { getAuthHeaders } from "@/features/auth/auth-helpers";

interface InvitesListProps {
  workspaceId: string;
  invites: PublicWorkspaceInvite[];
  isOwner: boolean;
  onInviteRevoked: (inviteId: string) => void;
}

export function InvitesList({
  workspaceId,
  invites,
  isOwner,
  onInviteRevoked,
}: InvitesListProps) {
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRevoke = async (inviteId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) {
      return;
    }

    setRevokingId(inviteId);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke invitation");
      }

      onInviteRevoked(inviteId);
    } catch (err: any) {
      setError(err.message || "Failed to revoke invitation");
    } finally {
      setRevokingId(null);
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

  if (invites.length === 0) {
    return (
      <div className="p-8 text-center border rounded-xl border-dashed border-border bg-card/40">
        <Clock className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-xs font-medium text-foreground">No pending invitations</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Generate an invitation link to invite team members to this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/30 text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
              {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {invites.map((invite) => {
              const isPending = invite.status === "pending";

              return (
                <tr key={invite.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-[11px] font-medium">
                      {invite.role}
                    </Badge>
                  </td>

                  <td className="px-4 py-3">
                    {invite.email ? (
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{invite.email}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Anyone with link</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                        invite.status === "accepted"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : invite.status === "revoked"
                          ? "bg-destructive/10 text-destructive"
                          : invite.status === "expired"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {invite.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(invite.expiresAt)}
                  </td>

                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      {isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(invite.id)}
                          disabled={revokingId === invite.id}
                          className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                          title="Revoke invitation link"
                        >
                          {revokingId === invite.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">Revoke</span>
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
