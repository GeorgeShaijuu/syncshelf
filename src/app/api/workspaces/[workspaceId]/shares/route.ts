import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { getWorkspaceMemberRole } from "@/lib/authz/permissions";
import {
  createShareSchema,
  calculateExpiration,
  toDateSafe,
  ShareStatus,
} from "@/lib/validation/share";
import { generateShareToken } from "@/lib/shares/share-crypto";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { getAppBaseUrl } from "@/lib/env";

interface RouteParams {
  params: Promise<{
    workspaceId: string;
  }>;
}

/**
 * POST /api/workspaces/[workspaceId]/shares
 * Creates a new public share for one or more selected clipboard entries.
 * Restricted strictly to Workspace Owner.
 * Generates a high-entropy bearer token, stores ONLY its SHA-256 hash, and returns the full URL once.
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

    if (role !== "owner") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can create public share links" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createShareSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      itemIds = [],
      scope: inputScope,
      accessMode = "public",
      defaultPermission = "viewer",
      allowPublicEditing = false,
      invitedRecipients = [],
      expiry = "7d",
      title,
    } = parseResult.data;

    const scope =
      inputScope ||
      (itemIds.length === 1
        ? "item"
        : itemIds.length > 1
        ? "selected_items"
        : "board");

    // Verify workspace existence
    const wsRef = adminDb.collection("workspaces").doc(workspaceId);
    const wsDoc = await wsRef.get();
    if (!wsDoc.exists) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // If scope is item or selected_items, verify all selected items exist and belong to this workspace
    if (scope === "item" || scope === "selected_items") {
      const itemsCollection = wsRef.collection("items");
      const itemSnapshots = await Promise.all(
        itemIds.map((id) => itemsCollection.doc(id).get())
      );

      const missingItemIndex = itemSnapshots.findIndex((snap) => !snap.exists);
      if (missingItemIndex !== -1) {
        return NextResponse.json(
          {
            error: "One or more selected items do not exist in this workspace",
            missingItemId: itemIds[missingItemIndex],
          },
          { status: 400 }
        );
      }
    }

    const { shareId, token, tokenHash } = generateShareToken();
    const expirationDate = calculateExpiration(expiry);
    const nowTimestamp = FieldValue.serverTimestamp();

    const formattedRecipients = invitedRecipients.map((r) => ({
      email: r.email.toLowerCase().trim(),
      permission: r.permission,
      addedAt: new Date().toISOString(),
    }));

    const shareRef = wsRef.collection("shares").doc(shareId);
    const pointerRef = adminDb.collection("publicSharePointers").doc(shareId);

    const batch = adminDb.batch();

    // 1. Write the canonical share document (storing ONLY tokenHash)
    batch.set(shareRef, {
      shareId,
      workspaceId,
      tokenHash,
      scope,
      itemIds: scope === "item" || scope === "selected_items" ? itemIds : [],
      accessMode,
      defaultPermission,
      allowPublicEditing: accessMode === "public" ? allowPublicEditing : false,
      invitedRecipients: accessMode === "specific_people" ? formattedRecipients : [],
      title: title || null,
      status: "active",
      createdBy: user.uid,
      createdAt: nowTimestamp,
      expiresAt: expirationDate ? Timestamp.fromDate(expirationDate) : null,
      revokedAt: null,
      revokedBy: null,
      viewCount: 0,
    });

    // 2. Write the fast public pointer for O(1) resolution without exposing workspaceId in the token
    batch.set(pointerRef, {
      shareId,
      workspaceId,
      createdAt: nowTimestamp,
    });

    await batch.commit();

    // 3. Write immutable audit record
    await logAuditEvent(adminDb, {
      workspaceId,
      actorUid: user.uid,
      action: "SHARE_CREATED",
      shareId,
      metadata: {
        scope,
        accessMode,
        defaultPermission,
        itemCount: itemIds.length,
        recipientCount: formattedRecipients.length,
        expiry,
        expiresAt: expirationDate ? expirationDate.toISOString() : null,
      },
    });

    // Construct trusted application URL
    const baseUrl = getAppBaseUrl(req);
    const publicUrl = `${baseUrl}/s/${token}`;

    return NextResponse.json(
      {
        id: shareId,
        token, // Returned exactly once upon creation
        url: publicUrl,
        scope,
        accessMode,
        defaultPermission,
        allowPublicEditing,
        invitedRecipients: formattedRecipients,
        title: title || undefined,
        itemIds: scope === "item" || scope === "selected_items" ? itemIds : undefined,
        itemCount: itemIds.length,
        status: "active",
        createdAt: new Date().toISOString(),
        expiresAt: expirationDate ? expirationDate.toISOString() : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SyncShelf Shares API] Error creating share:", error);
    return NextResponse.json(
      { error: "Internal server error creating share" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/[workspaceId]/shares
 * Lists all active, expired and revoked shares for the workspace.
 * Strictly restricted to Workspace Owner.
 * NEVER returns token hashes or raw tokens.
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

    if (role !== "owner") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace owners can view shares" },
        { status: 403 }
      );
    }

    const sharesSnap = await adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("shares")
      .orderBy("createdAt", "desc")
      .get();

    const now = new Date();

    const shares = sharesSnap.docs.map((doc) => {
      const data = doc.data();
      const expiresAtDate = data.expiresAt ? toDateSafe(data.expiresAt) : null;
      let effectiveStatus: ShareStatus = data.status || "active";

      // Dynamically compute expiration if status is marked active but date has passed
      if (effectiveStatus === "active" && expiresAtDate && expiresAtDate < now) {
        effectiveStatus = "expired";
      }

      return {
        id: doc.id,
        scope: data.scope || "item",
        accessMode: data.accessMode || "public",
        defaultPermission: data.defaultPermission || "viewer",
        allowPublicEditing: !!data.allowPublicEditing,
        invitedRecipients: data.invitedRecipients || [],
        title: data.title || null,
        itemIds: data.itemIds || [],
        itemCount: Array.isArray(data.itemIds) ? data.itemIds.length : 0,
        status: effectiveStatus,
        createdBy: data.createdBy,
        createdAt: toDateSafe(data.createdAt).toISOString(),
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
        revokedAt: data.revokedAt ? toDateSafe(data.revokedAt).toISOString() : null,
        revokedBy: data.revokedBy || null,
        viewCount: data.viewCount || 0,
        // Notice: tokenHash and raw tokens are STRICTLY omitted
      };
    });

    return NextResponse.json({ shares }, { status: 200 });
  } catch (error) {
    console.error("[SyncShelf Shares API] Error listing shares:", error);
    return NextResponse.json(
      { error: "Internal server error listing shares" },
      { status: 500 }
    );
  }
}
