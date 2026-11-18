import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canManageMembers, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { listAuditLogsQuerySchema, toDateSafe } from "@/lib/validation/team";
import { StoredAuditLog } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]/audit-logs
 * Retrieves the workspace's administrative audit history. Owner only.
 * Paginated and newest first.
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
        { error: "Forbidden: Only workspace owners can view audit logs" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = listAuditLogsQuerySchema.safeParse(queryParams);

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
      .collection("auditLogs")
      .orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await adminDb
        .collection("workspaces")
        .doc(workspaceId)
        .collection("auditLogs")
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
    const logs: StoredAuditLog[] = docs.map((doc) => {
      const data = doc.data();
      const createdAt = toDateSafe(data.createdAt, new Date(now)).toISOString();

      return {
        id: doc.id,
        workspaceId,
        actorUid: data.actorUid,
        action: data.action,
        targetUid: data.targetUid || null,
        inviteId: data.inviteId || null,
        shareId: data.shareId || null,
        metadata: data.metadata || {},
        createdAt,
      };
    });

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      logs,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[SyncShelf Audit API] Error listing audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error fetching audit logs" },
      { status: 500 }
    );
  }
}
