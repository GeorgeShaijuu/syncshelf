import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canViewWorkspace, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { updateWorkspaceSchema } from "@/lib/validation/workspace";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { toDateSafe } from "@/lib/validation/team";
import { hasR2Config } from "@/lib/env";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]
 * Fetches workspace settings, storage configuration status, and member overview.
 * Accessible to all active members; administrative details tailored by role.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
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

    if (!canViewWorkspace(role)) {
      return NextResponse.json(
        { error: "Forbidden: You are not an active member of this workspace" },
        { status: 403 }
      );
    }

    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const wsData = wsDoc.data()!;
    const isOwner = role === "owner";

    // Count pending invitations if owner
    let pendingInvitesCount = 0;
    if (isOwner) {
      try {
        const pendingSnap = await adminDb
          .collection("workspaces")
          .doc(workspaceId)
          .collection("invites")
          .where("status", "==", "pending")
          .get();
        pendingInvitesCount = pendingSnap.size;
      } catch {
        // Fallback to 0 if subcollection is empty
      }
    }

    // Server-side R2 configuration check (never exposes keys or secrets)
    const r2Ready = hasR2Config();

    const createdAtDate = toDateSafe(wsData.createdAt);
    const updatedAtDate = toDateSafe(wsData.updatedAt || wsData.createdAt);

    return NextResponse.json({
      id: workspaceId,
      name: wsData.name || "Workspace",
      ownerUid: wsData.ownerUid,
      memberCount: wsData.memberCount || 1,
      role,
      isOwner,
      createdAt: createdAtDate.toISOString(),
      updatedAt: updatedAtDate.toISOString(),
      pendingInvitesCount: isOwner ? pendingInvitesCount : undefined,
      storage: {
        isConfigured: r2Ready,
        provider: "Cloudflare R2 (Private S3 API)",
        bucketName: r2Ready ? "Configured & Active" : "Not Configured",
        maxUploadSizeBytes: 26214400, // 25 MB
        maxUploadSizeLabel: "25 MB",
        supportedCategories: [
          "Images (PNG, JPEG, GIF, WebP, SVG)",
          "Audio (MP3, WAV, OGG, WebM, FLAC)",
          "Video (MP4, WebM, QuickTime, MKV)",
          "Documents & Text (PDF, Text, Markdown, CSV, JSON, Office)",
          "Code Snippets & Archives (ZIP, TAR)",
        ],
      },
    });
  } catch (error) {
    console.error("[SyncShelf Workspace API] Error fetching workspace details:", error);
    return NextResponse.json(
      { error: "Internal server error fetching workspace details" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceId]
 * Renames workspace. Strictly Owner-only.
 * Atomically updates workspace document and owner's reverse membership index, with audit logging.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
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
        { error: "Forbidden: Only workspace owners can update workspace settings" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateWorkspaceSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name: newName } = parseResult.data;
    const wsRef = adminDb.collection("workspaces").doc(workspaceId);
    const ownerMembershipRef = adminDb
      .collection("users")
      .doc(user.uid)
      .collection("workspaceMemberships")
      .doc(workspaceId);

    const updated = await adminDb.runTransaction(async (transaction) => {
      const wsDoc = await transaction.get(wsRef);
      if (!wsDoc.exists) {
        return { notFound: true };
      }

      const currentData = wsDoc.data()!;
      const oldName = currentData.name || "Workspace";
      const now = FieldValue.serverTimestamp();

      // Update canonical workspace document
      transaction.update(wsRef, {
        name: newName,
        updatedAt: now,
      });

      // Update owner's reverse membership index if exists
      const memDoc = await transaction.get(ownerMembershipRef);
      if (memDoc.exists) {
        transaction.update(ownerMembershipRef, {
          workspaceName: newName,
        });
      }

      // Log administrative audit event
      await logAuditEvent(
        adminDb,
        {
          workspaceId,
          actorUid: user.uid,
          action: "WORKSPACE_RENAMED",
          metadata: {
            oldName,
            newName,
          },
        },
        transaction
      );

      return {
        id: workspaceId,
        name: newName,
        updatedAt: new Date().toISOString(),
      };
    });

    if ("notFound" in updated && updated.notFound) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[SyncShelf Workspace API] Error updating workspace:", error);
    return NextResponse.json(
      { error: "Internal server error updating workspace" },
      { status: 500 }
    );
  }
}
