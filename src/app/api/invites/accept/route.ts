import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { acceptInviteSchema, toDateSafe } from "@/lib/validation/team";
import { parseInviteToken } from "@/lib/invites/tokens";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { getClientIp } from "@/lib/security/rate-limiter";
import { limitRequest } from "@/lib/redis/client";

/**
 * POST /api/invites/accept
 * Accepts an invitation and atomically joins the target workspace.
 * Executes in a strict Firestore transaction to prevent concurrent race conditions.
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateCheck = await limitRequest({
      key: `invite_accept:${clientIp}`,
      limit: 15,
      windowSeconds: 60,
    });

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many invitation attempts. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
          },
        }
      );
    }

    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to accept an invitation" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = acceptInviteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { token } = parseResult.data;
    const { workspaceId: hintWorkspaceId, tokenHash } = parseInviteToken(token);
    const adminDb = getAdminDb();

    // 1. Locate the invitation document reference
    let targetInviteRef: FirebaseFirestore.DocumentReference | null = null;
    let targetWorkspaceId: string | null = hintWorkspaceId;

    if (hintWorkspaceId) {
      const snap = await adminDb
        .collection("workspaces")
        .doc(hintWorkspaceId)
        .collection("invites")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();

      if (!snap.empty) {
        targetInviteRef = snap.docs[0].ref;
      }
    }

    // Fallback: collectionGroup lookup
    if (!targetInviteRef) {
      const groupSnap = await adminDb
        .collectionGroup("invites")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();

      if (!groupSnap.empty) {
        targetInviteRef = groupSnap.docs[0].ref;
        targetWorkspaceId =
          groupSnap.docs[0].data()?.workspaceId ||
          groupSnap.docs[0].ref.parent.parent?.id ||
          null;
      }
    }

    if (!targetInviteRef || !targetWorkspaceId) {
      return NextResponse.json(
        { error: "Invalid or nonexistent invitation token" },
        { status: 404 }
      );
    }

    const finalWorkspaceId = targetWorkspaceId;
    const inviteRef = targetInviteRef;

    // References for transaction
    const wsRef = adminDb.collection("workspaces").doc(finalWorkspaceId);
    const memberRef = wsRef.collection("members").doc(user.uid);
    const userMembershipRef = adminDb
      .collection("users")
      .doc(user.uid)
      .collection("workspaceMemberships")
      .doc(finalWorkspaceId);

    // 2. Execute atomic transaction to prevent replay and simultaneous races
    const txResult = await adminDb.runTransaction(async (transaction) => {
      // Re-read invite document inside transaction
      const inviteDoc = await transaction.get(inviteRef);
      if (!inviteDoc.exists) {
        return { error: "Invitation not found", status: 404 };
      }

      const inviteData = inviteDoc.data()!;

      // Check status
      if (inviteData.status === "accepted") {
        return { error: "This invitation has already been accepted", status: 400 };
      }

      if (inviteData.status === "revoked") {
        return { error: "This invitation has been revoked by the workspace owner", status: 400 };
      }

      if (inviteData.status !== "pending") {
        return { error: "This invitation is no longer active", status: 400 };
      }

      // Check expiration
      const now = Date.now();
      const expiresAtDate = toDateSafe(inviteData.expiresAt, new Date(0));

      if (now > expiresAtDate.getTime()) {
        return { error: "This invitation has expired", status: 400 };
      }

      // Check workspace existence
      const wsDoc = await transaction.get(wsRef);
      if (!wsDoc.exists) {
        return { error: "The target workspace no longer exists", status: 404 };
      }
      const wsData = wsDoc.data()!;

      // Enforce role safety: Never grant Owner via invitation
      const assignedRole = inviteData.role;
      if (assignedRole !== "editor" && assignedRole !== "viewer") {
        return { error: "Invalid role assigned in invitation", status: 400 };
      }

      // Email restriction check
      if (inviteData.email) {
        const normalizedUserEmail = (user.email || "").trim().toLowerCase();
        const normalizedInviteEmail = inviteData.email.trim().toLowerCase();

        if (normalizedUserEmail !== normalizedInviteEmail) {
          return {
            error: `This invitation was issued to ${inviteData.email}. You are currently logged in as ${user.email || "a user with no email"}.`,
            status: 403,
          };
        }

        // Verified email requirement for email-bound invitations
        const isEmailVerified = Boolean(user.decodedToken.email_verified);
        if (!isEmailVerified) {
          return {
            error: "Your email address must be verified in Firebase Authentication before accepting this email-restricted invitation.",
            status: 403,
          };
        }
      }

      // Check if user is already an active member of this workspace
      const existingMemberDoc = await transaction.get(memberRef);
      if (existingMemberDoc.exists && existingMemberDoc.data()?.status === "active") {
        return {
          error: "You are already a member of this workspace",
          status: 409,
        };
      }

      // --- ALL CHECKS PASSED: APPLY ATOMIC MUTATIONS ---
      const nowTimestamp = FieldValue.serverTimestamp();

      // 1. Create workspace member document
      transaction.set(memberRef, {
        uid: user.uid,
        role: assignedRole,
        status: "active",
        email: user.email || null,
        displayName: user.displayName || null,
        joinedAt: nowTimestamp,
        invitedBy: inviteData.createdBy,
      });

      // 2. Create user's workspace membership index entry
      transaction.set(userMembershipRef, {
        workspaceId: finalWorkspaceId,
        workspaceName: wsData.name || "Workspace",
        role: assignedRole,
        ownerUid: wsData.ownerUid || finalWorkspaceId,
        joinedAt: nowTimestamp,
      });

      // 3. Mark invitation accepted
      transaction.update(inviteRef, {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedAt: nowTimestamp,
      });

      // 4. Increment workspace memberCount
      transaction.update(wsRef, {
        memberCount: FieldValue.increment(1),
        updatedAt: nowTimestamp,
      });

      // 5. Append audit record
      logAuditEvent(
        adminDb,
        {
          workspaceId: finalWorkspaceId,
          actorUid: user.uid,
          action: "INVITE_ACCEPTED",
          inviteId: inviteRef.id,
          metadata: {
            role: assignedRole,
            email: user.email || null,
          },
        },
        transaction
      );

      return {
        success: true,
        workspaceId: finalWorkspaceId,
        workspaceName: wsData.name || "Workspace",
        role: assignedRole,
      };
    });

    if (txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status });
    }

    return NextResponse.json({
      success: true,
      workspaceId: txResult.workspaceId,
      workspaceName: txResult.workspaceName,
      role: txResult.role,
      message: `Successfully joined ${txResult.workspaceName} as ${txResult.role}!`,
    });
  } catch (error) {
    console.error("[SyncShelf Invites API] Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Internal server error occurred while accepting invitation" },
      { status: 500 }
    );
  }
}
