import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { parseInviteToken } from "@/lib/invites/tokens";
import { toDateSafe } from "@/lib/validation/team";
import { getClientIp } from "@/lib/security/rate-limiter";
import { limitRequest } from "@/lib/redis/client";

/**
 * GET /api/invites/details?token=<token>
 * Public preview endpoint for the invitation landing page.
 * Returns non-sensitive workspace and invitation status metadata.
 */
export async function GET(req: NextRequest) {
  try {
    // Distributed rate limiting (abuse prevention: max 30 req/min per IP)
    const clientIp = getClientIp(req.headers);
    const rateCheck = await limitRequest({
      key: `invite_details:${clientIp}`,
      limit: 30,
      windowSeconds: 60,
    });

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
          },
        }
      );
    }

    const url = new URL(req.url);
    const rawToken = url.searchParams.get("token");

    if (!rawToken || !rawToken.trim()) {
      return NextResponse.json(
        { error: "Token query parameter is required" },
        { status: 400 }
      );
    }

    const { workspaceId, tokenHash } = parseInviteToken(rawToken);
    const adminDb = getAdminDb();

    let inviteDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let resolvedWorkspaceId = workspaceId;

    if (workspaceId) {
      const docSnapshot = await adminDb
        .collection("workspaces")
        .doc(workspaceId)
        .collection("invites")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();

      if (!docSnapshot.empty) {
        inviteDoc = docSnapshot.docs[0];
      }
    }

    // Fallback: collection group query if direct workspace lookup didn't match
    if (!inviteDoc) {
      const groupSnapshot = await adminDb
        .collectionGroup("invites")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();

      if (!groupSnapshot.empty) {
        inviteDoc = groupSnapshot.docs[0];
        resolvedWorkspaceId = inviteDoc.data()?.workspaceId || inviteDoc.ref.parent.parent?.id || null;
      }
    }

    if (!inviteDoc || !inviteDoc.exists || !resolvedWorkspaceId) {
      return NextResponse.json(
        { error: "Invitation not found or invalid" },
        { status: 404 }
      );
    }

    const inviteData = inviteDoc.data()!;
    const now = Date.now();
    const expiresAtDate = toDateSafe(inviteData.expiresAt, new Date(now));
    const isExpired = expiresAtDate.getTime() < now;

    // Fetch workspace name
    const wsDoc = await adminDb.collection("workspaces").doc(resolvedWorkspaceId).get();
    const workspaceName = wsDoc.exists ? wsDoc.data()?.name || "Workspace" : "Workspace";

    return NextResponse.json({
      valid: inviteData.status === "pending" && !isExpired,
      status: isExpired && inviteData.status === "pending" ? "expired" : inviteData.status,
      workspaceId: resolvedWorkspaceId,
      workspaceName,
      role: inviteData.role,
      emailRestrictedTo: inviteData.email || null,
      expiresAt: expiresAtDate.toISOString(),
      isExpired,
    });
  } catch (error) {
    console.error("[SyncShelf Invites API] Error fetching invite details:", error);
    return NextResponse.json(
      { error: "Internal server error resolving invitation details" },
      { status: 500 }
    );
  }
}
