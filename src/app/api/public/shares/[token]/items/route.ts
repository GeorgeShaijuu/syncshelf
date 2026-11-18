import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { createItemSchema } from "@/lib/validation/item";
import { detectContent } from "@/features/clipboard/capture";
import { logAuditEvent } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

/**
 * POST /api/public/shares/[token]/items
 * Creates a new clipboard item into the shared workspace.
 * Requires "editor" effective permission on the share link.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Check optional authorization header
    const authHeader = req.headers.get("authorization");
    let reqUserUid: string | null = null;
    let reqUserEmail: string | null = null;
    let reqUserDisplayName: string | null = null;
    let reqUserAvatarUrl: string | null = null;

    if (authHeader) {
      const user = await verifyAuthToken(authHeader);
      if (user) {
        reqUserUid = user.uid;
        reqUserEmail = user.email || null;
        reqUserDisplayName = user.displayName || user.email?.split("@")[0] || null;
        reqUserAvatarUrl = user.decodedToken.picture || null;
      }
    }

    // Verify share access with required "editor" permission
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

    // Auto-detect type if not explicitly supplied or if content provided
    let itemType = body.type;
    let itemTitle = body.title;
    let itemLanguage = body.language;

    if (!itemType && typeof body.content === "string") {
      const detected = detectContent(body.content);
      itemType = detected.type;
      itemTitle = body.title || detected.title;
      itemLanguage = detected.language;
    }

    const parseResult = createItemSchema.safeParse({
      ...body,
      type: itemType || "text",
      title: itemTitle || "Untitled Snippet",
      language: itemLanguage || body.language,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type, title, content, language, tags, isPinned, calendarDate } = parseResult.data;
    const cleanTags = Array.from(
      new Set((tags || []).map((t: string) => t.trim().toLowerCase()).filter(Boolean))
    );

    const adminDb = getAdminDb();
    const itemsCollection = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items");

    const newDocRef = itemsCollection.doc();
    const itemId = newDocRef.id;
    const now = FieldValue.serverTimestamp();

    const creatorId = reqUserUid || `shared_editor_${authResult.shareId.slice(0, 8)}`;
    const creatorName = reqUserDisplayName || "Shared Collaborator";

    const itemData = {
      id: itemId,
      workspaceId,
      type,
      title,
      content,
      language: type === "code" ? language || "plaintext" : null,
      calendarDate: calendarDate || null,
      createdBy: creatorId,
      createdByUid: reqUserUid || null,
      createdByDisplayName: creatorName,
      createdByAvatarUrl: reqUserAvatarUrl || null,
      updatedByUid: reqUserUid || null,
      updatedByDisplayName: creatorName,
      updatedByAvatarUrl: reqUserAvatarUrl || null,
      createdAt: now,
      updatedAt: now,
      isPinned: Boolean(isPinned),
      tags: cleanTags,
      contentLength: content.length,
    };

    await newDocRef.set(itemData);

    // If share scope was selected_items or item, append new item ID to share so it remains visible
    if (shareData.scope === "selected_items" || shareData.scope === "item") {
      await shareRef.update({
        itemIds: FieldValue.arrayUnion(itemId),
      });
    }

    // Write audit event
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: creatorId,
      action: "SHARE_ITEM_CREATED",
      itemId,
      metadata: {
        shareId: authResult.shareId,
        type,
        calendarDate: calendarDate || null,
      },
    });

    return NextResponse.json(
      {
        item: {
          id: itemId,
          type,
          title,
          content,
          language: itemData.language || undefined,
          calendarDate: calendarDate || null,
          createdByDisplayName: creatorName,
          createdByAvatarUrl: reqUserAvatarUrl || undefined,
          updatedByDisplayName: creatorName,
          updatedByAvatarUrl: reqUserAvatarUrl || undefined,
          isPinned: Boolean(isPinned),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SyncShelf Public Shares API] Error creating shared item:", error);
    return NextResponse.json(
      { error: "Internal server error creating item" },
      { status: 500 }
    );
  }
}
