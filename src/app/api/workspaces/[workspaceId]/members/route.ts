import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canViewWorkspace, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import {
  listMembersQuerySchema,
  WorkspaceMemberInfo,
  toDateSafe,
} from "@/lib/validation/team";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]/members
 * Lists members of the workspace.
 * Accessible to all active workspace members (Owner, Editor, Viewer).
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

    // Resolve workspace document for ownerUid
    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const ownerUid = wsDoc.data()?.ownerUid || workspaceId;

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = listMembersQuerySchema.safeParse(queryParams);

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
      .collection("members")
      .orderBy("joinedAt", "asc");

    if (cursor) {
      const cursorDoc = await adminDb
        .collection("workspaces")
        .doc(workspaceId)
        .collection("members")
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
    const members: WorkspaceMemberInfo[] = docs.map((doc) => {
      const data = doc.data();
      const joinedAt = toDateSafe(data.joinedAt, new Date(now)).toISOString();

      return {
        uid: doc.id,
        role: data.role,
        status: data.status || "active",
        joinedAt,
        invitedBy: data.invitedBy || undefined,
        email: data.email || undefined,
        displayName: data.displayName || undefined,
        isOwner: doc.id === ownerUid,
      };
    });

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      members,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[SyncShelf Members API] Error listing members:", error);
    return NextResponse.json(
      { error: "Internal server error listing workspace members" },
      { status: 500 }
    );
  }
}
