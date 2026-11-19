"use client";

import * as React from "react";
import Link from "next/link";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { useWorkspaceItemsContext } from "@/features/clipboard/workspace-items-context";
import { CalendarView } from "@/features/calendar/calendar-view";
import { ClayButton } from "@/components/ui/clay";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  useGlobalPasteCapture,
  CapturedClipboardPayload,
  detectContent,
} from "@/features/clipboard/capture";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { uploadFileToR2 } from "@/features/clipboard/r2-upload-client";
import { ClipboardItem, formatLocalDateString } from "@/lib/validation/item";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || "";
  const canManage =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "editor";

  // Realtime hook integrating onSnapshot and optimistic updates
  const {
    items,
    loading,
    optimisticPinToggle,
    optimisticItemCreated,
    optimisticItemUpdated,
    optimisticItemDeleted,
  } = useWorkspaceItemsContext();

  // Track currently active calendar date in a ref for global keyboard paste
  const activeDateRef = React.useRef<string>(formatLocalDateString(new Date()));

  // Universal Paste Handler: Ctrl+V / Cmd+V on Calendar saves to active date
  useGlobalPasteCapture({
    onCapture: async (payload: CapturedClipboardPayload) => {
      if (!activeWorkspace || !canManage || payload.kind === "empty") return;

      const targetDate = activeDateRef.current;

      if (payload.kind === "files") {
        for (const fileItem of payload.files) {
          try {
            const item = await uploadFileToR2({
              workspaceId: activeWorkspace.id,
              file: fileItem.file,
              title: fileItem.fileName,
              calendarDate: targetDate,
            });
            optimisticItemCreated(item);
          } catch (err) {
            console.error("Calendar paste upload failed:", err);
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
              calendarDate: targetDate,
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
          console.error("Calendar paste save failed:", err);
        }
      }
    },
    enabled: canManage,
  });

  // Handler for clicking the "Paste" button in the right panel
  const handlePasteButton = async (targetDateString: string) => {
    if (!activeWorkspace || !canManage) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) return;

      const detected = detectContent(text);
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
          calendarDate: targetDateString,
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
      console.error("Paste button failed:", err);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-[#FFE8D6] text-[#A65E26] flex items-center justify-center mx-auto shadow-xs">
          <CalendarIcon className="h-6 w-6 stroke-[2]" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-base font-bold text-[#24211F]">No Personal Calendar Active</h3>
          <p className="text-xs text-[#817A72]">
            Create a personal workspace to schedule and manage clips by date, or open a shared space.
          </p>
        </div>
        <Link href="/spaces">
          <ClayButton variant="primary" size="md">
            <span>Go to Spaces</span>
          </ClayButton>
        </Link>
      </div>
    );
  }

  return (
    <CalendarView
      workspace={activeWorkspace}
      items={items}
      loading={loading}
      canManage={canManage}
      onPinToggle={optimisticPinToggle}
      onItemUpdated={optimisticItemUpdated}
      onItemDeleted={optimisticItemDeleted}
      onPasteCapture={(dateStr) => {
        activeDateRef.current = dateStr;
        handlePasteButton(dateStr);
      }}
    />
  );
}
