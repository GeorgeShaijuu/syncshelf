import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { updateAndGetPresence } from "@/lib/presence/presence-store";
import { CollaboratorPresence } from "@/features/presence/presence-types";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export const dynamic = "force-dynamic";

/**
 * POST /api/public/shares/[token]/presence
 * Heartbeat endpoint for active presence in a shared space.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const authHeader = req.headers.get("authorization");
    let reqUserUid: string | null = null;
    let reqUserEmail: string | null = null;
    let userRecord: any = null;

    if (authHeader) {
      userRecord = await verifyAuthToken(authHeader);
      if (userRecord) {
        reqUserUid = userRecord.uid;
        reqUserEmail = userRecord.email || null;
      }
    }

    const authResult = await verifyShareAccess({
      token,
      reqUserUid,
      reqUserEmail,
    });

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json().catch(() => ({}));
    const view: "board" | "calendar" = body.view === "calendar" ? "calendar" : "board";
    const activeLane = typeof body.activeLane === "string" ? body.activeLane : null;
    const clientAnonId = typeof body.anonId === "string" ? body.anonId : null;

    const userId = userRecord?.uid || clientAnonId || `anon_${token.slice(0, 8)}`;
    const displayName =
      userRecord?.displayName ||
      (userRecord?.email ? userRecord.email.split("@")[0] : "Anonymous Viewer");

    const effectiveRole = authResult.effectivePermission === "editor" ? "editor" : "viewer";

    const collaborator: CollaboratorPresence = {
      userId,
      displayName,
      avatarUrl: (userRecord?.decodedToken?.picture as string) || null,
      view,
      activeLane,
      role: effectiveRole,
      lastActiveAt: Date.now(),
    };

    const collaborators = await updateAndGetPresence(authResult.workspaceId, collaborator);

    return NextResponse.json({ collaborators }, { status: 200 });
  } catch (err: any) {
    console.error("[Public Share Presence Error]", err);
    return NextResponse.json({ collaborators: [] }, { status: 200 });
  }
}
