import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/verify-id-token";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { toDateSafe, PublicClipboardItem } from "@/lib/validation/share";
import { isR2Configured } from "@/lib/r2/client";
import { createPresignedGetUrl } from "@/lib/r2/signed-urls";

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/public/shares/[token]/stream
 * Server-Sent Events (SSE) streaming endpoint for live collaborative workspace sharing.
 * Pushes item updates, additions, deletions, and instantaneous revocation events.
 * Preserves default-deny Firestore rules on client.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  // Verify auth token if provided
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

  // Validate share access
  const authResult = await verifyShareAccess({
    token,
    reqUserUid,
    reqUserEmail,
  });

  if (!authResult.authorized) {
    return new Response(
      JSON.stringify({
        error: authResult.error,
        requiresAuth: authResult.requiresAuth || false,
      }),
      {
        status: authResult.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { workspaceId, shareRef, shareData } = authResult;
  const adminDb = getAdminDb();
  const itemsCollection = adminDb
    .collection("workspaces")
    .doc(workspaceId)
    .collection("items");

  const scope = shareData.scope || "selected_items";
  const sharedItemIds = new Set(shareData.itemIds || []);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed by client
        }
      };

      // 1. Heartbeat timer every 25 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // 2. Share document listener (for immediate revocation or expiration)
      const unsubShare = shareRef.onSnapshot(
        (snap: any) => {
          if (!snap.exists) {
            sendEvent("share:revoked", { message: "Share link was deleted" });
            cleanup();
            return;
          }
          const currentData = snap.data();
          if (currentData.status === "revoked") {
            sendEvent("share:revoked", { message: "Share link has been revoked" });
            cleanup();
            return;
          }
          if (currentData.expiresAt) {
            const exp = toDateSafe(currentData.expiresAt);
            if (exp < new Date()) {
              sendEvent("share:expired", { message: "Share link has expired" });
              cleanup();
              return;
            }
          }
        },
        (err: any) => {
          console.error("[Share Stream] Share snapshot error:", err);
        }
      );

      // Helper to format item
      const formatItem = async (snap: any): Promise<PublicClipboardItem> => {
        const item = snap.data();
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
          isR2Configured()
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
                `[Share Stream] Failed to presign URL for item ${snap.id}:`,
                err
              );
            }
          }
        }

        return {
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
          createdAt: toDateSafe(item.createdAt).toISOString(),
          updatedAt: item.updatedAt ? toDateSafe(item.updatedAt).toISOString() : undefined,
        };
      };

      // 3. Items collection listener
      let isFirstSnapshot = true;
      const unsubItems = itemsCollection.orderBy("createdAt", "desc").onSnapshot(
        async (snapshot: any) => {
          if (isClosed) return;

          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            const initialItems: PublicClipboardItem[] = [];

            for (const doc of snapshot.docs) {
              if (
                scope === "item" ||
                scope === "selected_items"
              ) {
                if (!sharedItemIds.has(doc.id)) continue;
              }
              const formatted = await formatItem(doc);
              initialItems.push(formatted);
            }

            sendEvent("sync:init", { items: initialItems });
            return;
          }

          // Handle granular docChanges
          for (const change of snapshot.docChanges()) {
            const doc = change.doc;
            const itemId = doc.id;

            if (scope === "item" || scope === "selected_items") {
              if (!sharedItemIds.has(itemId)) continue;
            }

            if (change.type === "added") {
              const formatted = await formatItem(doc);
              sendEvent("item:created", { item: formatted });
            } else if (change.type === "modified") {
              const formatted = await formatItem(doc);
              sendEvent("item:updated", { item: formatted });
            } else if (change.type === "removed") {
              sendEvent("item:deleted", { itemId });
            }
          }
        },
        (err: any) => {
          console.error("[Share Stream] Items snapshot error:", err);
        }
      );

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatInterval);
        try {
          unsubShare();
          unsubItems();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
