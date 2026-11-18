import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import crypto from "crypto";

export type AuditAction =
  | "INVITE_CREATED"
  | "INVITE_REVOKED"
  | "INVITE_ACCEPTED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "WORKSPACE_RENAMED"
  | "SHARE_CREATED"
  | "SHARE_UPDATED"
  | "SHARE_REVOKED"
  | "SHARE_ITEM_CREATED"
  | "SHARE_ITEM_UPDATED"
  | "SHARE_ITEM_DELETED";

export interface CreateAuditLogParams {
  workspaceId: string;
  actorUid: string;
  action: AuditAction;
  targetUid?: string | null;
  inviteId?: string | null;
  shareId?: string | null;
  itemId?: string | null;
  metadata?: Record<string, any>;
}

export interface StoredAuditLog {
  id: string;
  workspaceId: string;
  actorUid: string;
  action: AuditAction;
  targetUid: string | null;
  inviteId: string | null;
  shareId: string | null;
  metadata: Record<string, any>;
  createdAt: string; // ISO string
}

/**
 * Creates an immutable audit record in `workspaces/{workspaceId}/auditLogs/{eventId}`.
 * Strictly server-side. Can execute within or outside an existing Firestore transaction.
 */
export async function logAuditEvent(
  adminDb: Firestore,
  params: CreateAuditLogParams,
  transaction?: Transaction
): Promise<string> {
  const {
    workspaceId,
    actorUid,
    action,
    targetUid = null,
    inviteId = null,
    shareId = null,
    metadata = {},
  } = params;

  const eventId = crypto.randomUUID();
  const logRef = adminDb
    .collection("workspaces")
    .doc(workspaceId)
    .collection("auditLogs")
    .doc(eventId);

  const logData = {
    id: eventId,
    workspaceId,
    actorUid,
    action,
    targetUid,
    inviteId,
    shareId,
    itemId: params.itemId || null,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (transaction) {
    transaction.set(logRef, logData);
  } else {
    await logRef.set(logData);
  }

  return eventId;
}
