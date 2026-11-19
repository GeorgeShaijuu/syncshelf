import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { toDateSafe } from "@/lib/validation/share";

/**
 * GET /api/user/recent-spaces
 * Lists recently viewed shared spaces for the authenticated user across all owners.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const adminDb = getAdminDb();
    
    // Fetch from recentSpaces collection (fallback to recentShares if recentSpaces is empty)
    let snap = await adminDb
      .collection("users")
      .doc(user.uid)
      .collection("recentSpaces")
      .orderBy("lastVisitedAt", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      snap = await adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentShares")
        .orderBy("visitedAt", "desc")
        .limit(30)
        .get();
    }

    const recentSpaces = snap.docs.map((doc) => {
      const data = doc.data();
      const visitedTime = data.lastVisitedAt || data.visitedAt;

      return {
        id: doc.id,
        shareId: data.shareId || doc.id,
        workspaceId: data.workspaceId || null,
        token: data.token,
        workspaceName: data.workspaceName || "Shared Space",
        title: data.title || null,
        scope: data.scope || "board",
        effectivePermission: data.effectivePermission || "viewer",
        ownerDisplayName: data.ownerDisplayName || "Workspace Owner",
        ownerAvatarUrl: data.ownerAvatarUrl || null,
        itemCount: typeof data.itemCount === "number" ? data.itemCount : 0,
        lastVisitedAt: toDateSafe(visitedTime).toISOString(),
      };
    });

    return NextResponse.json({ recentSpaces }, { status: 200 });
  } catch (error) {
    console.error("[Recent Spaces API] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching recent spaces" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/recent-spaces
 * Records or updates a recently visited shared space for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      shareId,
      workspaceId,
      token,
      workspaceName,
      title,
      scope,
      effectivePermission,
      ownerDisplayName,
      ownerAvatarUrl,
      itemCount,
    } = body;

    if (!shareId || !token) {
      return NextResponse.json(
        { error: "Missing required fields: shareId and token" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const now = FieldValue.serverTimestamp();

    const recordData = {
      shareId,
      workspaceId: workspaceId || null,
      token,
      workspaceName: workspaceName || "Shared Space",
      title: title || null,
      scope: scope || "board",
      effectivePermission: effectivePermission || "viewer",
      ownerDisplayName: ownerDisplayName || "Workspace Owner",
      ownerAvatarUrl: ownerAvatarUrl || null,
      itemCount: typeof itemCount === "number" ? itemCount : 0,
      lastVisitedAt: now,
      visitedAt: now,
    };

    // Store in both recentSpaces and recentShares for backwards compatibility
    await Promise.all([
      adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentSpaces")
        .doc(shareId)
        .set(recordData, { merge: true }),
      adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentShares")
        .doc(shareId)
        .set(recordData, { merge: true }),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Recent Spaces API] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error saving recent space" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/recent-spaces?shareId=[shareId]
 * Dismisses a recently visited space from the user's dashboard.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await verifyAuthToken(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing authentication token" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const shareId = url.searchParams.get("shareId");

    if (!shareId) {
      return NextResponse.json(
        { error: "Missing shareId parameter" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    await Promise.all([
      adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentSpaces")
        .doc(shareId)
        .delete(),
      adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentShares")
        .doc(shareId)
        .delete(),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Recent Spaces API] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error dismissing recent space" },
      { status: 500 }
    );
  }
}
