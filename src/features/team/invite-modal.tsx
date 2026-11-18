"use client";

import * as React from "react";
import {
  X,
  Mail,
  Shield,
  Clock,
  Copy,
  Check,
  Loader2,
  Users,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { PublicWorkspaceInvite } from "@/lib/validation/team";

interface InviteModalProps {
  isOpen: boolean;
  workspaceId: string;
  onClose: () => void;
  onInviteCreated: (invite: PublicWorkspaceInvite) => void;
}

export function InviteModal({
  isOpen,
  workspaceId,
  onClose,
  onInviteCreated,
}: InviteModalProps) {
  const [role, setRole] = React.useState<"editor" | "viewer">("editor");
  const [email, setEmail] = React.useState("");
  const [expiresInDays, setExpiresInDays] = React.useState(7);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Success state with generated link
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setRole("editor");
      setEmail("");
      setExpiresInDays(7);
      setError(null);
      setGeneratedUrl(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          email: email.trim() || undefined,
          expiresInDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invitation");
      }

      setGeneratedUrl(data.inviteUrl);
      onInviteCreated(data.invite);
    } catch (err: any) {
      setError(err.message || "An error occurred creating the invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link to clipboard");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Invite to Workspace</h2>
              <p className="text-xs text-muted-foreground">
                Generate a single-use, secure invitation link
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {generatedUrl ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span>Invitation link generated successfully!</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with your teammate. It is single-use and will expire in {expiresInDays} days.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Invitation Link</label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="font-mono text-xs select-all bg-muted/30"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5 text-xs h-9"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button type="button" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Role Assignment <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setRole("editor")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    role === "editor"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-border/80 bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">Editor</span>
                    {role === "editor" && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Can create, edit, pin, and upload files to the clipboard feed.
                  </p>
                </div>

                <div
                  onClick={() => setRole("viewer")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    role === "viewer"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-border/80 bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">Viewer</span>
                    {role === "viewer" && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Read-only access to view and download workspace items.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Email Binding */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Restrict to Email <span className="text-muted-foreground">(Optional)</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-1.5">
                If specified, only an account with this verified email can accept the link.
              </p>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Expiration Days */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Expiration
              </label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value={1}>1 Day</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (Default)</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Generate Invitation Link</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
