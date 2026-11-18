"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { useWorkspaceItemsContext } from "@/features/clipboard/workspace-items-context";
import { BoardCanvas } from "@/features/clipboard/board/board-canvas";
import {
  useGlobalPasteCapture,
  extractDataTransferPayload,
  CapturedClipboardPayload,
  detectContent,
  classifyFile,
} from "@/features/clipboard/capture";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { uploadFileToR2 } from "@/features/clipboard/r2-upload-client";
import { ClipboardItem } from "@/lib/validation/item";

export default function DashboardHomePage() {
  const { activeWorkspace } = useWorkspace();

  const workspaceId = activeWorkspace?.id || "";
  const canManage =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "editor";

  // Realtime hook integrating onSnapshot and optimistic updates
  const {
    items,
    loading,
    connectionState,
    lastSyncedAt,
    optimisticPinToggle,
    optimisticItemCreated,
    optimisticItemUpdated,
    optimisticItemDeleted,
  } = useWorkspaceItemsContext();

  // Universal Paste Handler: Ctrl+V / Cmd+V anywhere on the board
  useGlobalPasteCapture({
    onCapture: async (payload: CapturedClipboardPayload) => {
      if (!activeWorkspace || !canManage || payload.kind === "empty") return;

      if (payload.kind === "files") {
        for (const fileItem of payload.files) {
          try {
            const item = await uploadFileToR2({
              workspaceId: activeWorkspace.id,
              file: fileItem.file,
              title: fileItem.fileName,
            });
            optimisticItemCreated(item);
          } catch (err) {
            console.error("Paste upload failed:", err);
          }
        }
      } else if (payload.kind === "content") {
        const detected = payload.content;
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`/api/workspaces/${activeWorkspace.id}/items`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: detected.type,
              title: detected.title,
              content: detected.content,
              language: detected.language,
              isPinned: false,
              tags: [],
            }),
          });

          const data = await res.json();
          if (res.ok) {
            const savedItem: ClipboardItem = data.item || data;
            optimisticItemCreated(savedItem);
          }
        } catch (err) {
          console.error("Paste save failed:", err);
        }
      }
    },
    enabled: canManage,
  });

  if (!activeWorkspace) {
    return null;
  }

  return (
    <BoardCanvas
      workspace={activeWorkspace}
      items={items}
      loading={loading}
      canManage={canManage}
      onPinToggle={optimisticPinToggle}
      onItemCreated={optimisticItemCreated}
      onItemUpdated={optimisticItemUpdated}
      onItemDeleted={optimisticItemDeleted}
    />
  );
}
