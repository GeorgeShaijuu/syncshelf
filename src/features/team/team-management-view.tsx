"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  UserPlus,
  Clock,
  History,
  Shield,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Workspace } from "@/features/workspaces/workspace-context";
import {
  WorkspaceMemberInfo,
  PublicWorkspaceInvite,
} from "@/lib/validation/team";
import { StoredAuditLog } from "@/lib/audit/audit-logger";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import {
  getClientCachedData,
  setClientCachedData,
  invalidateClientCache,
} from "@/lib/cache/client-cache";
import { MembersTable } from "./members-table";
import { InvitesList } from "./invites-list";
import { AuditLogsView } from "./audit-logs-view";
import { InviteModal } from "./invite-modal";

interface TeamManagementViewProps {
  workspace: Workspace;
  initialTab?: TabType;
}

type TabType = "members" | "invites" | "audit";

export function TeamManagementView({ workspace, initialTab = "members" }: TeamManagementViewProps) {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = React.useState<TabType>(
    queryTab && ["members", "invites", "audit"].includes(queryTab) ? queryTab : initialTab
  );

  React.useEffect(() => {
    if (queryTab && ["members", "invites", "audit"].includes(queryTab)) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);

  const cacheKey = `team_${workspace.id}`;
  const initialCache = React.useMemo(() => {
    return getClientCachedData<{
      members: WorkspaceMemberInfo[];
      invites: PublicWorkspaceInvite[];
      auditLogs: StoredAuditLog[];
    }>(cacheKey);
  }, [cacheKey]);

  const [members, setMembers] = React.useState<WorkspaceMemberInfo[]>(
    initialCache?.members || []
  );
  const [invites, setInvites] = React.useState<PublicWorkspaceInvite[]>(
    initialCache?.invites || []
  );
  const [auditLogs, setAuditLogs] = React.useState<StoredAuditLog[]>(
    initialCache?.auditLogs || []
  );

  const [loading, setLoading] = React.useState(!initialCache);
  const [error, setError] = React.useState<string | null>(null);

  const isOwner = workspace.role === "owner";

  const fetchTeamData = React.useCallback(async () => {
    // Only block with a spinner if we have no cached data to display
    if (!initialCache && members.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // 1. Fetch Members (Allowed for all members)
      const membersRes = await fetch(`/api/workspaces/${workspace.id}/members`, {
        headers,
      });

      let fetchedMembers: WorkspaceMemberInfo[] = members;
      let fetchedInvites: PublicWorkspaceInvite[] = invites;
      let fetchedLogs: StoredAuditLog[] = auditLogs;

      if (membersRes.ok) {
        const data = await membersRes.json();
        fetchedMembers = data.members || [];
        setMembers(fetchedMembers);
      }

      // 2. Fetch Invites and Audit Logs (Owner only)
      if (isOwner) {
        const [invitesRes, auditRes] = await Promise.all([
          fetch(`/api/workspaces/${workspace.id}/invites`, { headers }),
          fetch(`/api/workspaces/${workspace.id}/audit-logs`, { headers }),
        ]);

        if (invitesRes.ok) {
          const invData = await invitesRes.json();
          fetchedInvites = invData.invites || [];
          setInvites(fetchedInvites);
        }

        if (auditRes.ok) {
          const auditData = await auditRes.json();
          fetchedLogs = auditData.logs || [];
          setAuditLogs(fetchedLogs);
        }
      }

      // Store in memory cache for instant future tab returns
      setClientCachedData(cacheKey, {
        members: fetchedMembers,
        invites: fetchedInvites,
        auditLogs: fetchedLogs,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [workspace.id, isOwner, cacheKey, initialCache, members, invites, auditLogs]);

  React.useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Team & Access</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage workspace members, role permissions, and pending invitations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTeamData}
            disabled={loading}
            className="h-9 px-3 text-xs"
            title="Refresh team data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="clay-btn-primary flex items-center gap-1.5 h-8 px-4 text-xs font-bold active:scale-95 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 stroke-[2.2]" />
              <span>Invite Teammate</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#EE624E]/10 border border-[#EE624E]/20 text-xs text-[#EE624E] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#EDE5D9] text-xs font-semibold pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === "members"
              ? "border-[#F58B35] text-[#F58B35] font-bold bg-[#F5EFE5]/50"
              : "border-transparent text-[#817A72] hover:text-[#24211F]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Members</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#FFE4D0] text-[#F58B35] text-[10px] font-bold">
            {members.length}
          </span>
        </button>

        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("invites")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === "invites"
                  ? "border-[#F58B35] text-[#F58B35] font-bold bg-[#F5EFE5]/50"
                  : "border-transparent text-[#817A72] hover:text-[#24211F]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending Invitations</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#FFE4D0] text-[#F58B35] text-[10px] font-bold">
                {invites.filter((i) => i.status === "pending").length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === "audit"
                  ? "border-[#F58B35] text-[#F58B35] font-bold bg-[#F5EFE5]/50"
                  : "border-transparent text-[#817A72] hover:text-[#24211F]"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit History</span>
            </button>
          </>
        )}
      </div>

      {/* Main Tab Panels */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading team records...</span>
        </div>
      ) : activeTab === "members" ? (
        <MembersTable
          workspaceId={workspace.id}
          members={members}
          isOwner={isOwner}
          onMemberUpdated={(updated) =>
            setMembers((prev) =>
              prev.map((m) => (m.uid === updated.uid ? updated : m))
            )
          }
          onMemberRemoved={(uid) =>
            setMembers((prev) => prev.filter((m) => m.uid !== uid))
          }
        />
      ) : activeTab === "invites" ? (
        <InvitesList
          workspaceId={workspace.id}
          invites={invites}
          isOwner={isOwner}
          onInviteRevoked={(inviteId) =>
            setInvites((prev) =>
              prev.map((i) => (i.id === inviteId ? { ...i, status: "revoked" } : i))
            )
          }
        />
      ) : (
        <AuditLogsView logs={auditLogs} loading={loading} />
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        workspaceId={workspace.id}
        onClose={() => setInviteModalOpen(false)}
        onInviteCreated={(newInvite) => {
          setInvites((prev) => [newInvite, ...prev]);
        }}
      />
    </div>
  );
}
