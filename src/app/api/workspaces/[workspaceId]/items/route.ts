import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import {
  canViewWorkspace,
  canCreateItem,
  getWorkspaceMemberRole,
} from "@/lib/authz/permissions";
import {
  createItemSchema,
  listItemsQuerySchema,
  ClipboardItem,
} from "@/lib/validation/item";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]/items
 * Lists clipboard items with newest-first cursor-based pagination and filtering.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    const adminDb = getAdminDb();
    const role = await getWorkspaceMemberRole(adminDb, workspaceId, user.uid);

    if (!canViewWorkspace(role)) {
      return NextResponse.json(
        { error: "Forbidden: You are not an active member of this workspace" },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parseResult = listItemsQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { limit, cursor, type, pinned, search } = parseResult.data;
    const itemsCollection = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items");

    let query: FirebaseFirestore.Query = itemsCollection;

    // Apply type filter if provided
    if (type) {
      query = query.where("type", "==", type);
    }

    // Apply pinned filter if provided
    if (pinned !== undefined) {
      query = query.where("isPinned", "==", pinned === "true");
    }

    // Order newest first
    query = query.orderBy("createdAt", "desc");

    // Cursor pagination (using startAfter on doc snapshot)
    if (cursor) {
      const cursorDoc = await itemsCollection.doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Fetch limit + 1 to detect whether there is a next page
    const snapshot = await query.limit(limit + 1).get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    let items: ClipboardItem[] = docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString();

      return {
        id: doc.id,
        workspaceId,
        type: data.type,
        title: data.title,
        content: data.content,
        language: data.language || undefined,
        calendarDate: data.calendarDate || undefined,
        originalFileName: data.originalFileName || undefined,
        objectKey: data.objectKey || undefined,
        mimeType: data.mimeType || undefined,
        sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
        createdBy: data.createdBy,
        createdByUid: data.createdByUid || data.createdBy || undefined,
        createdByDisplayName: data.createdByDisplayName || undefined,
        createdByAvatarUrl: data.createdByAvatarUrl || undefined,
        updatedByUid: data.updatedByUid || undefined,
        updatedByDisplayName: data.updatedByDisplayName || undefined,
        updatedByAvatarUrl: data.updatedByAvatarUrl || undefined,
        createdAt,
        updatedAt,
        isPinned: Boolean(data.isPinned),
        tags: Array.isArray(data.tags) ? data.tags : [],
        contentLength: data.contentLength || data.content?.length || 0,
      };
    });

    // Substring search filter (title, content, tags) for the retrieved items batch
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      items,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[SyncShelf Items API] GET items error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching clipboard items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/items
 * Creates a new clipboard item. Only Owner and Editor can create items.
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

    const adminDb = getAdminDb();
    const role = await getWorkspaceMemberRole(adminDb, workspaceId, user.uid);

    if (!canCreateItem(role)) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners and editors can create clipboard items" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createItemSchema.safeParse(body);

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

    // Clean tags: trim, lowercase, remove duplicates
    const cleanTags = Array.from(
      new Set((tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))
    );

    const now = FieldValue.serverTimestamp();
    const itemsCollection = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items");

    const newDocRef = itemsCollection.doc();
    const itemId = newDocRef.id;

    const itemData = {
      id: itemId,
      workspaceId,
      type,
      title,
      content,
      language: type === "code" ? language || "plaintext" : null,
      calendarDate: calendarDate || null,
      createdBy: user.uid, // DERIVED STRICTLY FROM AUTHENTICATED TOKEN
      createdByUid: user.uid,
      createdByDisplayName: user.displayName || user.email?.split("@")[0] || "Collaborator",
      createdByAvatarUrl: user.decodedToken.picture || null,
      updatedByUid: user.uid,
      updatedByDisplayName: user.displayName || user.email?.split("@")[0] || "Collaborator",
      updatedByAvatarUrl: user.decodedToken.picture || null,
      createdAt: now,
      updatedAt: now,
      isPinned: Boolean(isPinned),
      tags: cleanTags,
      contentLength: content.length,
    };

    await newDocRef.set(itemData);

    const createdItem: ClipboardItem = {
      ...itemData,
      language: itemData.language || undefined,
      calendarDate: calendarDate || undefined,
      createdByDisplayName: itemData.createdByDisplayName,
      createdByAvatarUrl: itemData.createdByAvatarUrl || undefined,
      updatedByDisplayName: itemData.updatedByDisplayName,
      updatedByAvatarUrl: itemData.updatedByAvatarUrl || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ item: createdItem }, { status: 201 });
  } catch (error) {
    console.error("[SyncShelf Items API] POST item error:", error);
    return NextResponse.json(
      { error: "Internal server error creating clipboard item" },
      { status: 500 }
    );
  }
}
