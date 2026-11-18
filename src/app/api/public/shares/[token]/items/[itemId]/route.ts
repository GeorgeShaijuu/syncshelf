import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { updateItemSchema } from "@/lib/validation/item";
import { logAuditEvent } from "@/lib/audit/audit-logger";

interface RouteParams {
  params: Promise<{
    token: string;
    itemId: string;
  }>;
}

/**
 * PATCH /api/public/shares/[token]/items/[itemId]
 * Updates a clipboard item within the shared workspace.
 * Requires "editor" effective permission on the share link.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { token, itemId } = await params;

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

    const { workspaceId, shareData } = authResult;
    const adminDb = getAdminDb();
    const itemRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(itemId);

    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check scope containment
    if (shareData.scope === "selected_items" || shareData.scope === "item") {
      const allowedIds = shareData.itemIds || [];
      if (!allowedIds.includes(itemId)) {
        return NextResponse.json(
          { error: "Item not included in this share link" },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title, content, language, tags, isPinned, calendarDate } = parseResult.data;
    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (title !== undefined) updates.title = title;
    if (content !== undefined) {
      updates.content = content;
      updates.contentLength = content.length;
    }
    if (language !== undefined) updates.language = language;
    if (calendarDate !== undefined) updates.calendarDate = calendarDate;
    if (isPinned !== undefined) updates.isPinned = Boolean(isPinned);
    if (tags !== undefined) {
      updates.tags = Array.from(
        new Set(tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean))
      );
    }

    await itemRef.update(updates);

    const creatorId = reqUserUid || `shared_editor_${authResult.shareId.slice(0, 8)}`;
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: creatorId,
      action: "SHARE_ITEM_UPDATED",
      itemId,
      metadata: {
        shareId: authResult.shareId,
        updatedFields: Object.keys(updates),
      },
    });

    const updatedSnap = await itemRef.get();
    const updatedData = updatedSnap.data()!;

    return NextResponse.json(
      {
        item: {
          id: itemId,
          type: updatedData.type,
          title: updatedData.title,
          content: updatedData.content,
          language: updatedData.language,
          calendarDate: updatedData.calendarDate,
          isPinned: updatedData.isPinned,
          createdAt: updatedData.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SyncShelf Public Shares API] Error updating shared item:", error);
    return NextResponse.json(
      { error: "Internal server error updating item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/public/shares/[token]/items/[itemId]
 * Deletes a clipboard item within the shared workspace.
 * Requires "editor" effective permission on the share link.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { token, itemId } = await params;

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
    const adminDb = getAdminDb();
    const itemRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(itemId);

    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (shareData.scope === "selected_items" || shareData.scope === "item") {
      const allowedIds = shareData.itemIds || [];
      if (!allowedIds.includes(itemId)) {
        return NextResponse.json(
          { error: "Item not included in this share link" },
          { status: 403 }
        );
      }
      // Remove from share's itemIds
      await shareRef.update({
        itemIds: FieldValue.arrayRemove(itemId),
      });
    }

    await itemRef.delete();

    const creatorId = reqUserUid || `shared_editor_${authResult.shareId.slice(0, 8)}`;
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: creatorId,
      action: "SHARE_ITEM_DELETED",
      itemId,
      metadata: {
        shareId: authResult.shareId,
      },
    });

    return NextResponse.json(
      { success: true, message: "Item deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SyncShelf Public Shares API] Error deleting shared item:", error);
    return NextResponse.json(
      { error: "Internal server error deleting item" },
      { status: 500 }
    );
  }
}
