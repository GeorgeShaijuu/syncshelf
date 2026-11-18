import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canManageMembers, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import {
  createInviteSchema,
  listInvitesQuerySchema,
  PublicWorkspaceInvite,
  toDateSafe,
} from "@/lib/validation/team";
import { generateInviteToken } from "@/lib/invites/tokens";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { getClientEnv, getAppBaseUrl } from "@/lib/env";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * POST /api/workspaces/[workspaceId]/invites
 * Creates a new single-use, high-entropy invitation for a workspace.
 * Owner only. Only Editor or Viewer roles can be granted.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    if (!canManageMembers(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can create invitations" },
        { status: 403 }
      );
    }

    // Verify workspace existence
    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createInviteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { role: inviteRole, email, expiresInDays } = parseResult.data;

    // Generate secure 32-byte cryptographic token and SHA-256 hash
    const { shareableToken, tokenHash } = generateInviteToken(workspaceId);
    const inviteId = crypto.randomUUID();

    const nowMillis = Date.now();
    const expiresAtMillis = nowMillis + expiresInDays * 24 * 60 * 60 * 1000;
    const expiresAtTimestamp = Timestamp.fromMillis(expiresAtMillis);

    const inviteRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("invites")
      .doc(inviteId);

    const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null;

    const inviteData = {
      id: inviteId,
      workspaceId,
      tokenHash,
      role: inviteRole,
      email: normalizedEmail,
      status: "pending",
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAtTimestamp,
      acceptedBy: null,
      acceptedAt: null,
      revokedAt: null,
      revokedBy: null,
    };

    await inviteRef.set(inviteData);

    // Record audit event
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: user.uid,
      action: "INVITE_CREATED",
      inviteId,
      metadata: {
        role: inviteRole,
        email: normalizedEmail,
        expiresInDays,
      },
    });

    // Build trusted invite URL using centrally validated application base URL
    const appUrl = getAppBaseUrl(req);
    const inviteUrl = `${appUrl}/invite/${shareableToken}`;

    const publicInvite: PublicWorkspaceInvite = {
      id: inviteId,
      workspaceId,
      role: inviteRole,
      email: normalizedEmail,
      status: "pending",
      createdBy: user.uid,
      createdAt: new Date(nowMillis).toISOString(),
      expiresAt: new Date(expiresAtMillis).toISOString(),
    };

    return NextResponse.json(
      {
        invite: publicInvite,
        inviteUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SyncShelf Invites API] Error creating invitation:", error);
    return NextResponse.json(
      { error: "Internal server error creating invitation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/[workspaceId]/invites
 * Lists invitations for the workspace. Owner only.
 * Strips all token hashes before returning to client.
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

    if (!canManageMembers(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can view invitations" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = listInvitesQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { limit, cursor } = parseResult.data;

    let query: FirebaseFirestore.Query = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("invites")
      .orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await adminDb
        .collection("workspaces")
        .doc(workspaceId)
        .collection("invites")
        .doc(cursor)
        .get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(limit + 1).get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const now = Date.now();
    const invites: PublicWorkspaceInvite[] = docs.map((doc) => {
      const data = doc.data();
      const expiresAtDate = toDateSafe(data.expiresAt, new Date(now + 7 * 86400000));
      const createdAtDate = toDateSafe(data.createdAt, new Date(now));
      const acceptedAtDate = data.acceptedAt ? toDateSafe(data.acceptedAt) : null;

      let status = data.status || "pending";
      // Compute virtual expired status if pending but past expiration
      if (status === "pending" && expiresAtDate.getTime() < now) {
        status = "expired";
      }

      return {
        id: doc.id,
        workspaceId,
        role: data.role,
        email: data.email || null,
        status,
        createdBy: data.createdBy,
        createdAt: createdAtDate.toISOString(),
        expiresAt: expiresAtDate.toISOString(),
        acceptedBy: data.acceptedBy || null,
        acceptedAt: acceptedAtDate ? acceptedAtDate.toISOString() : null,
      };
    });

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      invites,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[SyncShelf Invites API] Error listing invitations:", error);
    return NextResponse.json(
      { error: "Internal server error listing invitations" },
      { status: 500 }
    );
  }
}
