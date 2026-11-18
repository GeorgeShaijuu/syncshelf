"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { ClipboardFeed } from "@/features/clipboard/clipboard-feed";

export default function PinnedPage() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ClipboardFeed
        workspace={activeWorkspace}
        initialFilter="pinned"
        feedTitle="Pinned Items"
        feedDescription="Quick access to all pinned snippets, code blocks, links, and media across this workspace."
        hideFilterTabs={false}
      />
    </div>
  );
}
