import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { invalidateCache } from "@/lib/redis/client";
import {
  updateShareSchema,
  calculateExpiration,
  toDateSafe,
  ShareStatus,
} from "@/lib/validation/share";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    shareId: string;
  }>;
}

/**
 * PATCH /api/workspaces/[workspaceId]/shares/[shareId]
 * Updates permissions, invited recipients, or expiration for an existing share.
 * Strictly restricted to Workspace Owner.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, shareId } = await params;
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

    if (role !== "owner") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can update share links" },
        { status: 403 }
      );
    }

    const shareRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("shares")
      .doc(shareId);

    const shareSnap = await shareRef.get();

    if (!shareSnap.exists) {
      return NextResponse.json(
        { error: "Share not found" },
        { status: 404 }
      );
    }

    const shareData = shareSnap.data()!;
    if (shareData.status === "revoked") {
      return NextResponse.json(
        { error: "Cannot update a revoked share link" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateShareSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { defaultPermission, allowPublicEditing, invitedRecipients, expiry, title } =
      parseResult.data;

    const updates: Record<string, any> = {};

    if (defaultPermission !== undefined) {
      updates.defaultPermission = defaultPermission;
    }

    if (allowPublicEditing !== undefined) {
      updates.allowPublicEditing = allowPublicEditing;
    }

    if (invitedRecipients !== undefined) {
      updates.invitedRecipients = invitedRecipients.map((r) => ({
        email: r.email.toLowerCase().trim(),
        permission: r.permission,
        addedAt: new Date().toISOString(),
      }));
    }

    if (title !== undefined) {
      updates.title = title || null;
    }

    if (expiry !== undefined) {
      const expirationDate = calculateExpiration(expiry);
      updates.expiresAt = expirationDate ? Timestamp.fromDate(expirationDate) : null;
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    await shareRef.update(updates);

    // Write audit event
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: user.uid,
      action: "SHARE_UPDATED",
      shareId,
      metadata: {
        updatedFields: Object.keys(updates),
      },
    });

    const updatedSnap = await shareRef.get();
    const updatedData = updatedSnap.data()!;
    const expiresAtDate = updatedData.expiresAt ? toDateSafe(updatedData.expiresAt) : null;

    return NextResponse.json(
      {
        id: shareId,
        scope: updatedData.scope,
        accessMode: updatedData.accessMode || "public",
        defaultPermission: updatedData.defaultPermission || "viewer",
        allowPublicEditing: !!updatedData.allowPublicEditing,
        invitedRecipients: updatedData.invitedRecipients || [],
        title: updatedData.title || null,
        status: updatedData.status,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SyncShelf Shares API] Error updating share:", error);
    return NextResponse.json(
      { error: "Internal server error updating share" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/shares/[shareId]
 * Revokes an existing public share link immediately.
 * Strictly restricted to Workspace Owner.
 * Idempotent: repeated revocation calls succeed safely.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, shareId } = await params;
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

    if (role !== "owner") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can revoke share links" },
        { status: 403 }
      );
    }

    const shareRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("shares")
      .doc(shareId);

    const shareSnap = await shareRef.get();

    if (!shareSnap.exists) {
      return NextResponse.json(
        { error: "Share not found" },
        { status: 404 }
      );
    }

    const shareData = shareSnap.data()!;

    // Idempotent: if already revoked, return success immediately
    if (shareData.status === "revoked") {
      return NextResponse.json(
        {
          id: shareId,
          status: "revoked",
          alreadyRevoked: true,
          message: "Share link was already revoked",
        },
        { status: 200 }
      );
    }

    const now = FieldValue.serverTimestamp();

    // Mark canonical share as revoked
    await shareRef.update({
      status: "revoked",
      revokedAt: now,
      revokedBy: user.uid,
    });

    // Invalidate cached pointer in Redis
    await invalidateCache(`share_ptr:${shareId}`);

    // Write audit event
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: user.uid,
      action: "SHARE_REVOKED",
      shareId,
      metadata: {
        scope: shareData.scope,
        itemCount: Array.isArray(shareData.itemIds) ? shareData.itemIds.length : 0,
      },
    });

    return NextResponse.json(
      {
        id: shareId,
        status: "revoked",
        message: "Share link successfully revoked",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SyncShelf Shares API] Error revoking share:", error);
    return NextResponse.json(
      { error: "Internal server error revoking share" },
      { status: 500 }
    );
  }
}
