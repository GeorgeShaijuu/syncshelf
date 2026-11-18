import type { Firestore } from "firebase-admin/firestore";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceMember {
  uid: string;
  role: WorkspaceRole;
  status: "active" | "pending" | "suspended";
  joinedAt: FirebaseFirestore.Timestamp;
  invitedBy?: string;
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Checks if a given role satisfies the required minimum role.
 */
export function hasWorkspaceRole(
  role: WorkspaceRole | null | undefined,
  minimumRole: WorkspaceRole
): boolean {
  if (!role) return false;
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

/**
 * All active members (owner, editor, viewer) can view workspace content.
 */
export function canViewWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "viewer");
}

/**
 * Only editors and owners can create items.
 */
export function canCreateItem(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "editor");
}

/**
 * Only editors and owners can edit items.
 */
export function canEditItem(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "editor");
}

/**
 * Only editors and owners can delete items.
 */
export function canDeleteItem(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "editor");
}

/**
 * Only the owner can invite, modify, or remove members.
 */
export function canManageMembers(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "owner");
}

/**
 * Only the owner can update workspace settings or administer the workspace.
 */
export function canManageWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return hasWorkspaceRole(role, "owner");
}

/**
 * Server-side helper to retrieve the member record and role directly from Firestore.
 * Always checks trusted server documents. Never trusts client input.
 */
export async function getWorkspaceMemberRole(
  adminDb: Firestore,
  workspaceId: string,
  uid: string
): Promise<WorkspaceRole | null> {
  if (!workspaceId || !uid) return null;

  try {
    const memberDoc = await adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("members")
      .doc(uid)
      .get();

    if (!memberDoc.exists) {
      return null;
    }

    const data = memberDoc.data();
    if (!data || data.status !== "active") {
      return null;
    }

    return data.role as WorkspaceRole;
  } catch (error) {
    console.error("[SyncShelf Authz] Error retrieving member role:", error);
    return null;
  }
}
