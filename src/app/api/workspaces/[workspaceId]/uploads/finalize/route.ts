import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canCreateItem, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import { finalizeUploadSchema, ClipboardItem } from "@/lib/validation/item";
import { hasR2Config } from "@/lib/env";
import { verifyR2ObjectHead } from "@/lib/r2/signed-urls";
import { verifyUploadIntentToken } from "@/lib/r2/intent-token";
import { limitRequest } from "@/lib/redis/client";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * POST /api/workspaces/[workspaceId]/uploads/finalize
 * Verifies upload intent token, runs S3 HEAD verification on R2,
 * and atomically persists the metadata in Firestore.
 * Owner and Editor only.
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

    // Rate limiting: max 30 finalizations per minute per user
    const rateCheck = await limitRequest({
      key: `upload_finalize:${user.uid}`,
      limit: 30,
      windowSeconds: 60,
    });

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Upload finalization rate limit exceeded. Please wait a minute." },
        {
          status: 429,
          headers: { "Retry-After": rateCheck.resetSeconds.toString() },
        }
      );
    }

    const adminDb = getAdminDb();
    const role = await getWorkspaceMemberRole(adminDb, workspaceId, user.uid);

    if (!canCreateItem(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners and editors can finalize uploads" },
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

    const body = await req.json().catch(() => ({}));
    const parseResult = finalizeUploadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { intentToken } = parseResult.data;

    // Verify cryptographic intent token
    let intentPayload;
    try {
      intentPayload = verifyUploadIntentToken(intentToken);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Invalid or expired intent token: ${err.message}` },
        { status: 400 }
      );
    }

    // Verify workspace match
    if (intentPayload.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Intent token does not match the target workspace" },
        { status: 400 }
      );
    }

    // Verify user match
    if (intentPayload.userId !== user.uid) {
      return NextResponse.json(
        { error: "Intent token was not issued to this authenticated user" },
        { status: 403 }
      );
    }

    // Run S3 HEAD object verification directly against R2
    const headResult = await verifyR2ObjectHead({
      objectKey: intentPayload.objectKey,
      expectedSizeBytes: intentPayload.expectedSizeBytes,
      expectedMimeType: intentPayload.expectedMimeType,
    });

    if (!headResult.exists || !headResult.valid) {
      return NextResponse.json(
        {
          error: headResult.error || "R2 object verification failed",
          details: {
            exists: headResult.exists,
            valid: headResult.valid,
          },
        },
        { status: 400 }
      );
    }

    // Object verified in R2! Now create metadata document in Firestore
    const itemRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(intentPayload.itemId);

    // Guard against duplicate finalization
    const existing = await itemRef.get();
    if (existing.exists) {
      return NextResponse.json(
        { error: "Clipboard item already exists" },
        { status: 409 }
      );
    }

    const now = new Date();
    const docData = {
      id: intentPayload.itemId,
      workspaceId,
      type: intentPayload.type,
      title: intentPayload.title || intentPayload.originalFileName,
      content: intentPayload.originalFileName,
      originalFileName: intentPayload.originalFileName,
      objectKey: intentPayload.objectKey,
      mimeType: headResult.mimeType || intentPayload.expectedMimeType,
      sizeBytes: headResult.sizeBytes || intentPayload.expectedSizeBytes,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      isPinned: intentPayload.isPinned,
      tags: intentPayload.tags,
      calendarDate: intentPayload.calendarDate || null,
      contentLength: headResult.sizeBytes || intentPayload.expectedSizeBytes,
    };

    await itemRef.set(docData);

    const item: ClipboardItem = {
      id: intentPayload.itemId,
      workspaceId,
      type: intentPayload.type,
      title: docData.title,
      content: docData.content,
      calendarDate: intentPayload.calendarDate || undefined,
      originalFileName: docData.originalFileName,
      objectKey: docData.objectKey,
      mimeType: docData.mimeType,
      sizeBytes: docData.sizeBytes,
      createdBy: user.uid,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isPinned: docData.isPinned,
      tags: docData.tags,
      contentLength: docData.contentLength,
    };

    return NextResponse.json({
      success: true,
      item,
      message: "File uploaded and metadata created successfully",
    });
  } catch (error) {
    console.error("[SyncShelf Uploads API] Finalize upload error:", error);
    return NextResponse.json(
      { error: "Internal server error finalizing file upload" },
      { status: 500 }
    );
  }
}
