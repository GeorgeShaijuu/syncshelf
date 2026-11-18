import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canManageMembers, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { logAuditEvent } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    inviteId: string;
  }>;
}

/**
 * DELETE /api/workspaces/[workspaceId]/invites/[inviteId]
 * Revokes a pending workspace invitation. Owner only.
 * Transactional and prevents altering accepted invitations.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, inviteId } = await params;
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
        { error: "Forbidden: Only workspace owners can revoke invitations" },
        { status: 403 }
      );
    }

    const inviteRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("invites")
      .doc(inviteId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const inviteDoc = await transaction.get(inviteRef);
      if (!inviteDoc.exists) {
        return { notFound: true };
      }

      const inviteData = inviteDoc.data()!;

      if (inviteData.status === "accepted") {
        return {
          cannotRevoke: true,
          message: "Cannot revoke an invitation that has already been accepted.",
        };
      }

      if (inviteData.status === "revoked") {
        return { alreadyRevoked: true };
      }

      transaction.update(inviteRef, {
        status: "revoked",
        revokedAt: FieldValue.serverTimestamp(),
        revokedBy: user.uid,
      });

      logAuditEvent(
        adminDb,
        {
          workspaceId,
          actorUid: user.uid,
          action: "INVITE_REVOKED",
          inviteId,
          metadata: {
            role: inviteData.role,
            email: inviteData.email,
          },
        },
        transaction
      );

      return { success: true };
    });

    if (result.notFound) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (result.cannotRevoke) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error) {
    console.error("[SyncShelf Invites API] Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Internal server error revoking invitation" },
      { status: 500 }
    );
  }
}
