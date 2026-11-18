import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canManageMembers, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { updateMemberRoleSchema } from "@/lib/validation/team";
import { logAuditEvent } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    uid: string;
  }>;
}

/**
 * PATCH /api/workspaces/[workspaceId]/members/[uid]
 * Modifies an existing workspace member's role (editor or viewer).
 * Owner only. Demoting the Owner is strictly prohibited.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, uid: targetUid } = await params;
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const adminDb = getAdminDb();
    const role = await getWorkspaceMemberRole(adminDb, workspaceId, user.uid);

    if (!canManageMembers(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can change member roles" },
        { status: 403 }
      );
    }

    const wsRef = adminDb.collection("workspaces").doc(workspaceId);
    const wsDoc = await wsRef.get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const ownerUid = wsDoc.data()?.ownerUid || workspaceId;
    if (targetUid === ownerUid) {
      return NextResponse.json(
        { error: "Forbidden: Cannot change or demote the workspace owner's role" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateMemberRoleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { role: newRole } = parseResult.data;

    const memberRef = wsRef.collection("members").doc(targetUid);
    const userMembershipRef = adminDb
      .collection("users")
      .doc(targetUid)
      .collection("workspaceMemberships")
      .doc(workspaceId);

    const txResult = await adminDb.runTransaction(async (transaction) => {
      const memberDoc = await transaction.get(memberRef);
      if (!memberDoc.exists) {
        return { notFound: true };
      }

      const previousRole = memberDoc.data()?.role;
      const now = FieldValue.serverTimestamp();

      transaction.update(memberRef, {
        role: newRole,
        updatedAt: now,
      });

      transaction.update(userMembershipRef, {
        role: newRole,
        updatedAt: now,
      });

      logAuditEvent(
        adminDb,
        {
          workspaceId,
          actorUid: user.uid,
          action: "MEMBER_ROLE_CHANGED",
          targetUid,
          metadata: {
            previousRole,
            newRole,
          },
        },
        transaction
      );

      return { success: true, previousRole };
    });

    if (txResult.notFound) {
      return NextResponse.json({ error: "Member not found in workspace" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Member role updated to ${newRole}`,
      uid: targetUid,
      role: newRole,
    });
  } catch (error) {
    console.error("[SyncShelf Members API] Error updating member role:", error);
    return NextResponse.json(
      { error: "Internal server error updating member role" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/members/[uid]
 * Removes a member from the workspace. Owner only.
 * Removing the workspace Owner is strictly prohibited.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, uid: targetUid } = await params;
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const adminDb = getAdminDb();
    const role = await getWorkspaceMemberRole(adminDb, workspaceId, user.uid);

    if (!canManageMembers(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can remove members" },
        { status: 403 }
      );
    }

    const wsRef = adminDb.collection("workspaces").doc(workspaceId);
    const wsDoc = await wsRef.get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const ownerUid = wsDoc.data()?.ownerUid || workspaceId;
    if (targetUid === ownerUid) {
      return NextResponse.json(
        { error: "Forbidden: The workspace owner cannot be removed from their own workspace" },
        { status: 400 }
      );
    }

    const memberRef = wsRef.collection("members").doc(targetUid);
    const userMembershipRef = adminDb
      .collection("users")
      .doc(targetUid)
      .collection("workspaceMemberships")
      .doc(workspaceId);

    const txResult = await adminDb.runTransaction(async (transaction) => {
      const memberDoc = await transaction.get(memberRef);
      if (!memberDoc.exists) {
        return { notFound: true };
      }

      const memberData = memberDoc.data()!;

      transaction.delete(memberRef);
      transaction.delete(userMembershipRef);

      transaction.update(wsRef, {
        memberCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logAuditEvent(
        adminDb,
        {
          workspaceId,
          actorUid: user.uid,
          action: "MEMBER_REMOVED",
          targetUid,
          metadata: {
            previousRole: memberData.role,
          },
        },
        transaction
      );

      return { success: true };
    });

    if (txResult.notFound) {
      return NextResponse.json({ error: "Member not found in workspace" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Member removed from workspace successfully",
      uid: targetUid,
    });
  } catch (error) {
    console.error("[SyncShelf Members API] Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error removing member" },
      { status: 500 }
    );
  }
}
