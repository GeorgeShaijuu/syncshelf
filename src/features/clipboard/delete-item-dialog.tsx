"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { ClipboardItem } from "@/lib/validation/item";

interface DeleteItemDialogProps {
  item: ClipboardItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemDeleted: (itemId: string) => void;
  customDeleteUrl?: (item: ClipboardItem) => string;
}

export function DeleteItemDialog({
  item,
  isOpen,
  onClose,
  onItemDeleted,
  customDeleteUrl,
}: DeleteItemDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const url = customDeleteUrl
        ? customDeleteUrl(item)
        : `/api/workspaces/${item.workspaceId}/items/${item.id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete item.");
      }

      onItemDeleted(item.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delete Clipboard Item</h2>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground">
          <span className="font-semibold block truncate mb-1">{item.title}</span>
          <span className="text-muted-foreground line-clamp-2">{item.content}</span>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-6">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Delete Item
          </Button>
        </div>
      </div>
    </div>
  );
}
