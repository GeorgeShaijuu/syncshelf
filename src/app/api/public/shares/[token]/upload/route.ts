import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { hasR2Config } from "@/lib/env";
import { createPresignedPutUrl, verifyR2ObjectHead } from "@/lib/r2/signed-urls";
import { createUploadIntentToken, verifyUploadIntentToken } from "@/lib/r2/intent-token";
import { isMimeTypeAllowed } from "@/lib/validation/item";
import { logAuditEvent } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

/**
 * POST /api/public/shares/[token]/upload
 * Upload handling (sign & finalize) for editors on shared workspaces.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const authHeader = req.headers.get("authorization");
    let reqUserUid: string | null = null;
    let reqUserEmail: string | null = null;

    if (authHeader) {
      const user = await verifyAuthToken(authHeader);
      if (user) {
        reqUserUid = user.uid;
        reqUserEmail = user.email || null;
      }
    }

    const authResult = await verifyShareAccess({
      token,
      reqUserUid,
      reqUserEmail,
      requiredPermission: "editor",
    });

    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: authResult.error,
          requiresAuth: authResult.requiresAuth || false,
        },
        { status: authResult.status }
      );
    }

    const { workspaceId, shareRef, shareData } = authResult;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sign";

    if (!hasR2Config()) {
      return NextResponse.json(
        { error: "Cloudflare R2 storage is not configured on this server." },
        { status: 503 }
      );
    }

    const adminDb = getAdminDb();
    const creatorId = reqUserUid || `shared_editor_${authResult.shareId.slice(0, 8)}`;

    if (action === "sign") {
      const { fileName, fileSizeBytes, mimeType, type } = body;
      if (!fileName || !fileSizeBytes || !mimeType || !type) {
        return NextResponse.json(
          { error: "Missing required upload parameters (fileName, fileSizeBytes, mimeType, type)" },
          { status: 400 }
        );
      }

      if (!isMimeTypeAllowed(type, mimeType)) {
        return NextResponse.json(
          { error: `MIME type '${mimeType}' is not allowed for content type '${type}'` },
          { status: 400 }
        );
      }

      const itemId = crypto.randomUUID();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `workspaces/${workspaceId}/items/${itemId}/${sanitizedFileName}`;

      const uploadUrl = await createPresignedPutUrl({
        objectKey,
        contentType: mimeType,
        contentLength: fileSizeBytes,
        expiresIn: 300,
      });

      const intentToken = createUploadIntentToken({
        workspaceId,
        itemId,
        objectKey,
        expectedSizeBytes: fileSizeBytes,
        expectedMimeType: mimeType,
        type,
        title: fileName,
        tags: [],
        isPinned: false,
        originalFileName: sanitizedFileName,
        userId: creatorId,
      });

      return NextResponse.json(
        {
          uploadUrl,
          objectKey,
          intentToken,
          itemId,
        },
        { status: 200 }
      );
    } else if (action === "finalize") {
      const { intentToken, title, calendarDate } = body;
      if (!intentToken) {
        return NextResponse.json({ error: "Missing intentToken" }, { status: 400 });
      }

      const verifiedIntent = verifyUploadIntentToken(intentToken);
      if (!verifiedIntent) {
        return NextResponse.json(
          { error: "Invalid, expired, or tampered upload intent token" },
          { status: 400 }
        );
      }

      if (verifiedIntent.workspaceId !== workspaceId) {
        return NextResponse.json(
          { error: "Upload intent token does not match workspace" },
          { status: 403 }
        );
      }

      const headResult = await verifyR2ObjectHead({
        objectKey: verifiedIntent.objectKey,
        expectedMimeType: verifiedIntent.expectedMimeType,
        expectedSizeBytes: verifiedIntent.expectedSizeBytes,
      });

      if (!headResult.exists) {
        return NextResponse.json(
          { error: "Uploaded file was not found in storage" },
          { status: 400 }
        );
      }

      const now = FieldValue.serverTimestamp();
      const itemData = {
        id: verifiedIntent.itemId,
        workspaceId,
        type: verifiedIntent.type,
        title: title || verifiedIntent.objectKey.split("/").pop() || "Uploaded File",
        content: `Stored file: ${verifiedIntent.objectKey}`,
        r2ObjectKey: verifiedIntent.objectKey,
        objectKey: verifiedIntent.objectKey,
        fileName: verifiedIntent.objectKey.split("/").pop(),
        fileSizeBytes: headResult.sizeBytes || verifiedIntent.expectedSizeBytes,
        mimeType: headResult.mimeType || verifiedIntent.expectedMimeType,
        calendarDate: calendarDate || null,
        createdBy: creatorId,
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        tags: [],
      };

      const itemsCollection = adminDb
        .collection("workspaces")
        .doc(workspaceId)
        .collection("items");

      await itemsCollection.doc(verifiedIntent.itemId).set(itemData);

      if (shareData.scope === "selected_items" || shareData.scope === "item") {
        await shareRef.update({
          itemIds: FieldValue.arrayUnion(verifiedIntent.itemId),
        });
      }

      await logAuditEvent(adminDb, {
        workspaceId,
        actorUid: creatorId,
        action: "SHARE_ITEM_CREATED",
        itemId: verifiedIntent.itemId,
        metadata: {
          shareId: authResult.shareId,
          type: verifiedIntent.type,
          fileName: itemData.fileName,
        },
      });

      return NextResponse.json(
        {
          item: {
            id: verifiedIntent.itemId,
            type: verifiedIntent.type,
            title: itemData.title,
            fileName: itemData.fileName,
            fileSizeBytes: itemData.fileSizeBytes,
            mimeType: itemData.mimeType,
            calendarDate: calendarDate || null,
            createdAt: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[SyncShelf Public Shares Upload API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error handling upload" },
      { status: 500 }
    );
  }
}
