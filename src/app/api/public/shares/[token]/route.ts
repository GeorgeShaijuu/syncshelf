import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import {
  toDateSafe,
  PublicClipboardItem,
  PublicShareMetadata,
} from "@/lib/validation/share";
import { getClientIp } from "@/lib/security/rate-limiter";
import { limitRequest } from "@/lib/redis/client";
import { isR2Configured } from "@/lib/r2/client";
import { createPresignedGetUrl } from "@/lib/r2/signed-urls";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/**
 * GET /api/public/shares/[token]
 * Resolves a public share token for anonymous visitors or authenticated users.
 * Respects accessMode: public, authenticated, specific_people.
 * Returns items according to scope: selected_items, board, calendar, workspace.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Distributed rate limiting check with in-memory fallback (max 60 req/min per IP)
    const clientIp = getClientIp(req.headers);
    const rateCheck = await limitRequest({
      key: `public_share:${clientIp}`,
      limit: 60,
      windowSeconds: 60,
    });

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            ...SECURITY_HEADERS,
            "Retry-After": rateCheck.resetSeconds.toString(),
          },
        }
      );
    }

    const { token } = await params;

    // 2. Check for optional Authorization header to detect user identity
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

    // 3. Central Share Authorization Verification
    const authResult = await verifyShareAccess({
      token,
      reqUserUid,
      reqUserEmail,
      requiredPermission: "viewer",
    });

    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: authResult.error,
          status: authResult.requiresAuth
            ? "auth_required"
            : authResult.status === 410
            ? authResult.error.includes("expired")
              ? "expired"
              : "revoked"
            : "not_found",
          requiresAuth: authResult.requiresAuth || false,
        },
        { status: authResult.status, headers: SECURITY_HEADERS }
      );
    }

    const {
      workspaceId,
      shareId,
      shareData,
      workspaceData,
      shareRef,
      effectivePermission,
    } = authResult;

    const adminDb = getAdminDb();
    const itemsCollection = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("items");

    const scope = shareData.scope || "selected_items";
    const r2Ready = isR2Configured();
    const publicItems: PublicClipboardItem[] = [];

    if (scope === "item" || scope === "selected_items") {
      // Retrieve only the explicitly shared item IDs
      const sharedItemIds: string[] = Array.isArray(shareData.itemIds)
        ? shareData.itemIds
        : [];

      if (sharedItemIds.length === 0) {
        return NextResponse.json(
          { error: "The shared content is no longer available", status: "unavailable" },
          { status: 404, headers: SECURITY_HEADERS }
        );
      }

      const itemSnapshots = await Promise.all(
        sharedItemIds.map((id) => itemsCollection.doc(id).get())
      );

      for (const snap of itemSnapshots) {
        if (!snap.exists) continue;
        const item = snap.data()!;
        let presignedUrl: string | undefined = undefined;
        const objectKey = item.objectKey || item.r2ObjectKey;
        const fileName = item.originalFileName || item.fileName;
        const fileSizeBytes =
          typeof item.sizeBytes === "number" ? item.sizeBytes : item.fileSizeBytes;

        if (
          (item.type === "image" ||
            item.type === "audio" ||
            item.type === "video" ||
            item.type === "file") &&
          objectKey &&
          r2Ready
        ) {
          const expectedPrefix = `workspaces/${workspaceId}/items/${snap.id}/`;
          if (objectKey.startsWith(expectedPrefix)) {
            try {
              presignedUrl = await createPresignedGetUrl({
                objectKey,
                expiresIn: 300,
                downloadFileName: fileName,
              });
            } catch (err) {
              console.error(
                `[SyncShelf Public Shares] Failed to presign URL for item ${snap.id}:`,
                err
              );
            }
          }
        }

        publicItems.push({
          id: snap.id,
          type: item.type,
          title: item.title || "Untitled Snippet",
          content: item.content || "",
          language: item.language,
          url: item.url,
          fileName,
          fileSizeBytes,
          mimeType: item.mimeType,
          presignedUrl,
          isPinned: !!item.isPinned,
          calendarDate: item.calendarDate || null,
          createdByDisplayName: item.createdByDisplayName || undefined,
          createdByAvatarUrl: item.createdByAvatarUrl || undefined,
          updatedByDisplayName: item.updatedByDisplayName || undefined,
          updatedByAvatarUrl: item.updatedByAvatarUrl || undefined,
          createdAt: toDateSafe(item.createdAt).toISOString(),
          updatedAt: item.updatedAt ? toDateSafe(item.updatedAt).toISOString() : undefined,
        });
      }

      if (publicItems.length === 0) {
        return NextResponse.json(
          { error: "The shared content is no longer available", status: "unavailable" },
          { status: 404, headers: SECURITY_HEADERS }
        );
      }
    } else {
      // Board, Calendar, or Workspace scope: Retrieve all active items in the workspace
      const allItemsSnap = await itemsCollection.orderBy("createdAt", "desc").get();

      for (const snap of allItemsSnap.docs) {
        const item = snap.data()!;
        let presignedUrl: string | undefined = undefined;
        const objectKey = item.objectKey || item.r2ObjectKey;
        const fileName = item.originalFileName || item.fileName;
        const fileSizeBytes =
          typeof item.sizeBytes === "number" ? item.sizeBytes : item.fileSizeBytes;

        if (
          (item.type === "image" ||
            item.type === "audio" ||
            item.type === "video" ||
            item.type === "file") &&
          objectKey &&
          r2Ready
        ) {
          const expectedPrefix = `workspaces/${workspaceId}/items/${snap.id}/`;
          if (objectKey.startsWith(expectedPrefix)) {
            try {
              presignedUrl = await createPresignedGetUrl({
                objectKey,
                expiresIn: 300,
                downloadFileName: fileName,
              });
            } catch (err) {
              console.error(
                `[SyncShelf Public Shares] Failed to presign URL for item ${snap.id}:`,
                err
              );
            }
          }
        }

        publicItems.push({
          id: snap.id,
          type: item.type,
          title: item.title || "Untitled Snippet",
          content: item.content || "",
          language: item.language,
          url: item.url,
          fileName,
          fileSizeBytes,
          mimeType: item.mimeType,
          presignedUrl,
          isPinned: !!item.isPinned,
          calendarDate: item.calendarDate || null,
          createdByDisplayName: item.createdByDisplayName || undefined,
          createdByAvatarUrl: item.createdByAvatarUrl || undefined,
          updatedByDisplayName: item.updatedByDisplayName || undefined,
          updatedByAvatarUrl: item.updatedByAvatarUrl || undefined,
          createdAt: toDateSafe(item.createdAt).toISOString(),
          updatedAt: item.updatedAt ? toDateSafe(item.updatedAt).toISOString() : undefined,
        });
      }
    }

    // Increment view count asynchronously
    if (shareRef) {
      shareRef.update({ viewCount: FieldValue.increment(1) }).catch(() => {});
    }

    // Public share metadata
    const publicMetadata: PublicShareMetadata = {
      id: shareId,
      scope,
      status: "active",
      accessMode: shareData.accessMode || "public",
      defaultPermission: shareData.defaultPermission || "viewer",
      allowPublicEditing: !!shareData.allowPublicEditing,
      effectivePermission,
      workspaceName: workspaceData.name || "SyncShelf Workspace",
      workspaceOwnerName: workspaceData.ownerDisplayName || workspaceData.name || "Workspace Owner",
      workspaceOwnerAvatarUrl: workspaceData.ownerAvatarUrl || null,
      itemCount: publicItems.length,
      title: shareData.title || undefined,
      createdAt: toDateSafe(shareData.createdAt).toISOString(),
      expiresAt: shareData.expiresAt ? toDateSafe(shareData.expiresAt).toISOString() : null,
    };

    return NextResponse.json(
      {
        share: publicMetadata,
        items: publicItems,
      },
      {
        status: 200,
        headers: SECURITY_HEADERS,
      }
    );
  } catch (error) {
    console.error("[SyncShelf Public Shares] Error resolving share:", error);
    return NextResponse.json(
      { error: "Internal server error resolving share", status: "error" },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
