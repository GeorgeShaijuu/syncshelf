"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { BoardTopNav } from "@/components/layout/board-top-nav";
import { FloatingToolbar } from "@/components/layout/floating-toolbar";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";
import { BoardProvider } from "@/features/clipboard/board/board-context";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { uploadFileToR2 } from "@/features/clipboard/r2-upload-client";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  onOpenQuickCapture?: () => void;
  syncState?: "live" | "syncing" | "offline" | "error";
  lastSyncedAt?: Date | null;
}

export function AppShell({
  children,
  onOpenQuickCapture,
  syncState = "live",
  lastSyncedAt,
}: AppShellProps) {
  const pathname = usePathname();
  const { activeWorkspace } = useWorkspace();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isFullScreenView = pathname === "/" || pathname === "/board" || pathname === "/calendar";

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeWorkspace) return;
    const fileList = Array.from(e.target.files);

    for (const file of fileList) {
      try {
        await uploadFileToR2({
          workspaceId: activeWorkspace.id,
          file,
          title: file.name,
        });
      } catch (err) {
        console.error("Failed to upload file:", err);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <BoardProvider>
      <div className="relative flex flex-col h-screen w-full overflow-hidden bg-[#FAF7F0] text-[#24211F]">
        {/* Organic Corner Abstract Artwork */}
        <OrganicBackgroundArtwork />

        {/* Hidden File Input for Floating Toolbar Upload Action */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* 1. Horizontal Top Navigation Bar */}
        <BoardTopNav syncState={syncState} lastSyncedAt={lastSyncedAt} />

        {/* 2. Floating Vertical Toolbar on Left */}
        <FloatingToolbar
          onOpenCapture={onOpenQuickCapture}
          onTriggerUpload={handleTriggerUpload}
        />

        {/* 3. Main Workspace Area */}
        <main
          className={cn(
            "relative z-10 flex-1 w-full",
            isFullScreenView
              ? "overflow-hidden"
              : "overflow-y-auto overflow-x-hidden scrollbar-thin"
          )}
        >
          {isFullScreenView ? (
            children
          ) : (
            <div className="w-full min-h-full pl-20 pr-6 py-6 max-w-6xl mx-auto">
              {children}
            </div>
          )}
        </main>
      </div>
    </BoardProvider>
  );
}
