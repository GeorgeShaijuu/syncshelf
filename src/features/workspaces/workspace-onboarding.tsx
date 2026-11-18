"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Loader2, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export function WorkspaceOnboarding() {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a workspace name.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      await createWorkspace(name.trim());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create workspace.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 mb-5">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to SyncShelf
          </h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Every account owns one shared shelf for synchronized text, code, links, and files. Let&apos;s create your workspace.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Create your first workspace</span>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Workspace Name</label>
              <Input
                type="text"
                placeholder="e.g. Personal Shelf or Engineering Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
              <p className="text-[11px] text-muted-foreground">
                You will be assigned as the Workspace Owner/Admin.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full h-10 text-xs font-semibold gap-1.5 mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Create Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Deterministic document ID: workspaces/{`{uid}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
