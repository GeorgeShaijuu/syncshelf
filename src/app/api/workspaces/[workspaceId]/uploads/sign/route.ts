import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { canCreateItem, getWorkspaceMemberRole } from "@/lib/authz/permissions";
import {
  signUploadSchema,
  isMimeTypeAllowed,
} from "@/lib/validation/item";
import { hasR2Config } from "@/lib/env";
import { createPresignedPutUrl } from "@/lib/r2/signed-urls";
import { createUploadIntentToken } from "@/lib/r2/intent-token";
import { limitRequest } from "@/lib/redis/client";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * POST /api/workspaces/[workspaceId]/uploads/sign
 * Generates a presigned PUT URL and signed intent token for direct-to-R2 upload.
 * Owner and Editor only. Viewers are rejected with 403.
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

    // Rate limiting: max 30 upload signs per minute per user
    const rateCheck = await limitRequest({
      key: `upload_sign:${user.uid}`,
      limit: 30,
      windowSeconds: 60,
    });

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Please wait a minute before uploading more files." },
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
        { error: "Forbidden: Only workspace owners and editors can upload files" },
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
    const parseResult = signUploadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Validate MIME type against allowed lists for the specified item type
    if (!isMimeTypeAllowed(data.type, data.mimeType)) {
      return NextResponse.json(
        {
          error: `MIME type '${data.mimeType}' is not allowed for item type '${data.type}'`,
          details: { mimeType: [`Unsupported MIME type: ${data.mimeType}`] },
        },
        { status: 400 }
      );
    }

    const itemId = crypto.randomUUID();
    const sanitizedFileName = data.fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const objectKey = `workspaces/${workspaceId}/items/${itemId}/${Date.now()}-${sanitizedFileName}`;

    // 15-minute expiration for upload URL
    const expiresIn = 900;

    const uploadUrl = await createPresignedPutUrl({
      objectKey,
      contentType: data.mimeType,
      contentLength: data.fileSize,
      expiresIn,
    });

    const intentToken = createUploadIntentToken(
      {
        workspaceId,
        itemId,
        objectKey,
        expectedSizeBytes: data.fileSize,
        expectedMimeType: data.mimeType,
        type: data.type,
        title: data.title || data.fileName,
        tags: data.tags,
        calendarDate: data.calendarDate || undefined,
        isPinned: data.isPinned,
        originalFileName: data.fileName,
        userId: user.uid,
      },
      expiresIn
    );

    return NextResponse.json({
      uploadUrl,
      objectKey,
      itemId,
      intentToken,
      expiresIn,
    });
  } catch (error) {
    console.error("[SyncShelf Uploads API] Sign upload error:", error);
    return NextResponse.json(
      { error: "Internal server error generating upload signature" },
      { status: 500 }
    );
  }
}
