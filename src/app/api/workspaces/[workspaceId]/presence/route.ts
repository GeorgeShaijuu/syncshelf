import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canViewWorkspace, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { updateAndGetPresence, getActivePresence } from "@/lib/presence/presence-store";
import { CollaboratorPresence } from "@/features/presence/presence-types";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/[workspaceId]/presence
 * Heartbeat endpoint for active multiplayer collaborator presence.
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

    if (!canViewWorkspace(role)) {
      return NextResponse.json(
        { error: "Forbidden: You are not an active member of this workspace" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const view: "board" | "calendar" = body.view === "calendar" ? "calendar" : "board";
    const activeLane = typeof body.activeLane === "string" ? body.activeLane : null;

    const collaborator: CollaboratorPresence = {
      userId: user.uid,
      displayName: user.displayName || user.email?.split("@")[0] || "Collaborator",
      avatarUrl: (user.decodedToken?.picture as string) || null,
      view,
      activeLane,
      role: role || "viewer",
      lastActiveAt: Date.now(),
    };

    const collaborators = await updateAndGetPresence(workspaceId, collaborator);

    return NextResponse.json({ collaborators }, { status: 200 });
  } catch (err: any) {
    console.error("[Workspace Presence Error]", err);
    return NextResponse.json({ collaborators: [] }, { status: 200 });
  }
}

/**
 * GET /api/workspaces/[workspaceId]/presence
 * Read-only retrieval of current active collaborators.
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

    const collaborators = await getActivePresence(workspaceId);
    return NextResponse.json({ collaborators }, { status: 200 });
  } catch (err: any) {
    console.error("[Workspace Presence GET Error]", err);
    return NextResponse.json({ collaborators: [] }, { status: 200 });
  }
}
