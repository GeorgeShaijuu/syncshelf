import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canViewWorkspace, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { hasR2Config } from "@/lib/env";
import { createPresignedGetUrl } from "@/lib/r2/signed-urls";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    itemId: string;
  }>;
}

/**
 * GET/POST /api/workspaces/[workspaceId]/items/[itemId]/url
 * Generates a short-lived presigned GET URL for secure viewing or downloading of private files.
 * Allowed for Owner, Editor, and Viewer.
 */
async function handleGetSignedUrl(req: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, itemId } = await params;
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

    if (!hasR2Config()) {
      return NextResponse.json(
        {
          error: "Cloudflare R2 storage is not configured on this server.",
          code: "R2_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    // Query item from Firestore
    const itemDoc = await adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(itemId)
      .get();

    if (!itemDoc.exists) {
      return NextResponse.json(
        { error: "Clipboard item not found in this workspace" },
        { status: 404 }
      );
    }

    const itemData = itemDoc.data()!;

    if (!itemData.objectKey) {
      return NextResponse.json(
        { error: "This item does not have an associated file object in storage" },
        { status: 400 }
      );
    }

    // Workspace scoping security check
    if (!itemData.objectKey.startsWith(`workspaces/${workspaceId}/`)) {
      return NextResponse.json(
        { error: "Storage object key does not belong to this workspace" },
        { status: 403 }
      );
    }

    const urlObj = new URL(req.url);
    const downloadQuery = urlObj.searchParams.get("download");
    const isDownload = downloadQuery === "true" || downloadQuery === "1";

    const expiresIn = 3600; // 1 hour
    const presignedUrl = await createPresignedGetUrl({
      objectKey: itemData.objectKey,
      expiresIn,
      downloadFileName: isDownload ? itemData.originalFileName || "file" : undefined,
    });

    return NextResponse.json({
      url: presignedUrl,
      expiresIn,
      originalFileName: itemData.originalFileName,
      mimeType: itemData.mimeType,
      sizeBytes: itemData.sizeBytes,
    });
  } catch (error) {
    console.error("[SyncShelf Items API] Presigned GET URL error:", error);
    return NextResponse.json(
      { error: "Internal server error generating download URL" },
      { status: 500 }
    );
  }
}

export { handleGetSignedUrl as GET, handleGetSignedUrl as POST };
