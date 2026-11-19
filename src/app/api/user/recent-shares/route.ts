import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { toDateSafe } from "@/lib/validation/share";

/**
 * GET /api/user/recent-shares
 * Lists recently viewed shared links for the authenticated user.
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
    const snap = await adminDb
      .collection("users")
      .doc(user.uid)
      .collection("recentShares")
      .orderBy("visitedAt", "desc")
      .limit(20)
      .get();

    const recentShares = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        shareId: data.shareId || doc.id,
        token: data.token,
        workspaceName: data.workspaceName || "Shared Workspace",
        title: data.title || null,
        scope: data.scope || "board",
        effectivePermission: data.effectivePermission || "viewer",
        visitedAt: toDateSafe(data.visitedAt).toISOString(),
      };
    });

    return NextResponse.json({ recentShares }, { status: 200 });
  } catch (error) {
    console.error("[Recent Shares API] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching recent shares" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/recent-shares
 * Records or updates a recently viewed shared link for the authenticated user.
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
    const { shareId, token, workspaceName, title, scope, effectivePermission } = body;

    if (!shareId || !token) {
      return NextResponse.json(
        { error: "Missing shareId or token" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const docRef = adminDb
      .collection("users")
      .doc(user.uid)
      .collection("recentShares")
      .doc(shareId);

    await docRef.set(
      {
        shareId,
        token,
        workspaceName: workspaceName || "Shared Workspace",
        title: title || null,
        scope: scope || "board",
        effectivePermission: effectivePermission || "viewer",
        visitedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Recent Shares API] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error saving recent share" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/recent-shares?shareId=[shareId]
 * Dismisses a recently viewed shared link from the user's dashboard.
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
        .collection("recentShares")
        .doc(shareId)
        .delete(),
      adminDb
        .collection("users")
        .doc(user.uid)
        .collection("recentSpaces")
        .doc(shareId)
        .delete(),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Recent Shares API] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error dismissing recent share" },
      { status: 500 }
    );
  }
}
