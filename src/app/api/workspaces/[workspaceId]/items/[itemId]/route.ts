import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import {
  canEditItem,
  canDeleteItem,
  getWorkspaceMemberRole,
} from "@/lib/authz/permissions";
import {
  updateItemSchema,
  ClipboardItem,
} from "@/lib/validation/item";
import { hasR2Config } from "@/lib/env";
import { deleteR2Object } from "@/lib/r2/signed-urls";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
    itemId: string;
  }>;
}

/**
 * PATCH /api/workspaces/[workspaceId]/items/[itemId]
 * Updates permitted fields of a clipboard item. Owner & Editor only.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    if (!canEditItem(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners and editors can edit clipboard items" },
        { status: 403 }
      );
    }

    const itemRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(itemId);

    const existingDoc = await itemRef.get();
    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: "Clipboard item not found in this workspace" },
        { status: 404 }
      );
    }

    const existingData = existingDoc.data()!;
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

    const data = parseResult.data;
    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: user.uid,
      updatedByDisplayName: user.displayName || user.email?.split("@")[0] || "Collaborator",
      updatedByAvatarUrl: user.decodedToken.picture || null,
    };

    if (data.title !== undefined) {
      updates.title = data.title;
    }

    if (data.content !== undefined) {
      updates.content = data.content;
      updates.contentLength = data.content.length;
    }

    if (data.type !== undefined) {
      updates.type = data.type;
      if (data.type !== "code") {
        updates.language = null;
      }
    }

    if (data.language !== undefined) {
      updates.language = data.language || null;
    }

    if (data.tags !== undefined) {
      updates.tags = Array.from(
        new Set(data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
      );
    }

    if (data.isPinned !== undefined) {
      updates.isPinned = data.isPinned;
    }

    if (data.calendarDate !== undefined) {
      updates.calendarDate = data.calendarDate || null;
    }

    await itemRef.update(updates);

    const updatedDoc = await itemRef.get();
    const updatedData = updatedDoc.data()!;

    const createdAt = updatedData.createdAt instanceof Timestamp
      ? updatedData.createdAt.toDate().toISOString()
      : existingData.createdAt instanceof Timestamp
      ? existingData.createdAt.toDate().toISOString()
      : new Date().toISOString();

    const updatedAt = updatedData.updatedAt instanceof Timestamp
      ? updatedData.updatedAt.toDate().toISOString()
      : new Date().toISOString();

    const responseItem: ClipboardItem = {
      id: itemId,
      workspaceId,
      type: updatedData.type,
      title: updatedData.title,
      content: updatedData.content,
      language: updatedData.language || undefined,
      calendarDate: updatedData.calendarDate || undefined,
      originalFileName: updatedData.originalFileName || undefined,
      objectKey: updatedData.objectKey || undefined,
      mimeType: updatedData.mimeType || undefined,
      sizeBytes: typeof updatedData.sizeBytes === "number" ? updatedData.sizeBytes : undefined,
      createdBy: updatedData.createdBy,
      createdAt,
      updatedAt,
      isPinned: Boolean(updatedData.isPinned),
      tags: Array.isArray(updatedData.tags) ? updatedData.tags : [],
      contentLength: updatedData.contentLength || updatedData.content?.length || 0,
    };

    return NextResponse.json({ item: responseItem });
  } catch (error) {
    console.error("[SyncShelf Items API] PATCH item error:", error);
    return NextResponse.json(
      { error: "Internal server error updating clipboard item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/items/[itemId]
 * Deletes a clipboard item. Owner & Editor only.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    if (!canDeleteItem(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners and editors can delete clipboard items" },
        { status: 403 }
      );
    }

    const itemRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items")
      .doc(itemId);

    const existingDoc = await itemRef.get();
    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: "Clipboard item not found in this workspace" },
        { status: 404 }
      );
    }

    const existingData = existingDoc.data()!;

    // Clean up R2 object if this was a file/media item and R2 is configured
    if (existingData.objectKey && hasR2Config()) {
      try {
        await deleteR2Object({ objectKey: existingData.objectKey });
      } catch (r2Error) {
        console.warn("[SyncShelf Items API] Warning deleting R2 object:", r2Error);
        // Continue to delete Firestore doc so references do not become permanently stuck
      }
    }

    await itemRef.delete();

    return NextResponse.json({
      success: true,
      deletedId: itemId,
      message: "Clipboard item deleted successfully",
    });
  } catch (error) {
    console.error("[SyncShelf Items API] DELETE item error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting clipboard item" },
      { status: 500 }
    );
  }
}
