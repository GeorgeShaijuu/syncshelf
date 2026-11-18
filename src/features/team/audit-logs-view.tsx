"use client";

import * as React from "react";
import { History, Shield, UserPlus, UserMinus, UserCheck, Key, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StoredAuditLog, AuditAction } from "@/lib/audit/audit-logger";

interface AuditLogsViewProps {
  logs: StoredAuditLog[];
  loading: boolean;
}

export function AuditLogsView({ logs, loading }: AuditLogsViewProps) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  const getActionDetails = (action: AuditAction) => {
    switch (action) {
      case "INVITE_CREATED":
        return {
          label: "Invite Created",
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          icon: Key,
        };
      case "INVITE_REVOKED":
        return {
          label: "Invite Revoked",
          color: "bg-destructive/10 text-destructive border-destructive/20",
          icon: AlertCircle,
        };
      case "INVITE_ACCEPTED":
        return {
          label: "Invite Accepted",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          icon: UserPlus,
        };
      case "MEMBER_ROLE_CHANGED":
        return {
          label: "Role Changed",
          color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          icon: Shield,
        };
      case "MEMBER_REMOVED":
        return {
          label: "Member Removed",
          color: "bg-destructive/10 text-destructive border-destructive/20",
          icon: UserMinus,
        };
      default:
        return {
          label: action,
          color: "bg-muted text-muted-foreground",
          icon: History,
        };
    }
  };

  const renderDescription = (log: StoredAuditLog) => {
    const meta = log.metadata || {};
    switch (log.action) {
      case "INVITE_CREATED":
        return `Created invitation for role '${meta.role}'${
          meta.email ? ` restricted to ${meta.email}` : " (public link)"
        } valid for ${meta.expiresInDays || 7} days.`;
      case "INVITE_REVOKED":
        return `Revoked pending invitation (role '${meta.role}').`;
      case "INVITE_ACCEPTED":
        return `User joined workspace with role '${meta.role}'.`;
      case "MEMBER_ROLE_CHANGED":
        return `Changed member (${log.targetUid}) role from '${meta.previousRole}' to '${meta.newRole}'.`;
      case "MEMBER_REMOVED":
        return `Removed member (${log.targetUid}) with previous role '${meta.previousRole}'.`;
      default:
        return JSON.stringify(meta);
    }
  };

  if (logs.length === 0 && !loading) {
    return (
      <div className="p-8 text-center border rounded-xl border-dashed border-border bg-card/40">
        <History className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-xs font-medium text-foreground">No audit logs recorded</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Administrative actions like invitations and member modifications will be logged here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="divide-y divide-border/60">
          {logs.map((log) => {
            const details = getActionDetails(log.action);
            const Icon = details.icon;

            return (
              <div
                key={log.id}
                className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${details.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{details.label}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        by {log.actorUid.slice(0, 8)}...
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{renderDescription(log)}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {formatTime(log.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
