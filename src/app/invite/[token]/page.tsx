"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
  Clock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  ArrowRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";
import { useAuth } from "@/features/auth/auth-context";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";

interface InviteDetails {
  valid: boolean;
  status: "pending" | "accepted" | "revoked" | "expired";
  workspaceId: string;
  workspaceName: string;
  role: "editor" | "viewer";
  emailRestrictedTo: string | null;
  expiresAt: string;
  isExpired: boolean;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { refreshWorkspaces, selectWorkspace } = useWorkspace();

  const [details, setDetails] = React.useState<InviteDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Fetch invitation preview details
  React.useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetch(`/api/invites/details?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to resolve invitation");
        }
        if (isMounted) {
          setDetails(data);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || "Invalid or expired invitation");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!isAuthenticated) return;
    setAccepting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join workspace");
      }

      setSuccess(`Joined ${data.workspaceName} as ${data.role}!`);

      // Refresh user's workspace list and select joined workspace
      await refreshWorkspaces();
      selectWorkspace(data.workspaceId);

      // Redirect to home feed after brief confirmation
      setTimeout(() => {
        router.push("/spaces");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const emailMismatch =
    details?.emailRestrictedTo &&
    user?.email &&
    user.email.toLowerCase().trim() !== details.emailRestrictedTo.toLowerCase().trim();

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#FAF7F0] text-[#24211F] overflow-hidden select-none animate-in fade-in">
      <OrganicBackgroundArtwork />
      <div className="relative z-10 w-full max-w-md clay-surface p-6 sm:p-8 space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 pb-1">
          <span className="text-xl font-bold tracking-tight text-[#24211F]">
            syncshelf
          </span>
        </div>

        {loading || authLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Checking invitation link...</p>
          </div>
        ) : error && !details ? (
          <div className="space-y-4 text-center py-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Invitation Invalid</h2>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Link href="/spaces" className="inline-block pt-2">
              <Button variant="outline" size="sm" className="text-xs">
                Back to SyncShelf
              </Button>
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-4 text-center py-6">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 w-12 h-12 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Welcome to the Team!</h2>
              <p className="text-xs text-muted-foreground mt-1">{success}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-primary pt-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Redirecting to your workspace...</span>
            </div>
          </div>
        ) : details ? (
          <div className="space-y-5">
            {/* Invitation Details Card */}
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-foreground">
                Join {details.workspaceName}
              </h2>
              <p className="text-xs text-muted-foreground">
                You have been invited to collaborate as an{" "}
                <span className="font-semibold text-foreground capitalize">
                  {details.role}
                </span>
                .
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workspace</span>
                <span className="font-medium text-foreground">{details.workspaceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned Role</span>
                <span className="font-medium capitalize text-foreground">{details.role}</span>
              </div>
              {details.emailRestrictedTo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Restricted to Email</span>
                  <span className="font-mono text-[11px] text-foreground">
                    {details.emailRestrictedTo}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span className="text-muted-foreground">
                  {new Date(details.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Mismatch Warning */}
            {emailMismatch && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 space-y-1.5">
                <p className="font-semibold">Email address mismatch</p>
                <p className="text-[11px]">
                  This invitation was sent specifically to <strong>{details.emailRestrictedTo}</strong>. You are currently logged in as <strong>{user?.email}</strong>.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {!details.valid ? (
              <div className="p-3 rounded-xl bg-muted text-center text-xs text-muted-foreground">
                This invitation is {details.status} and cannot be accepted.
              </div>
            ) : !isAuthenticated ? (
              <div className="space-y-2.5 pt-2">
                <p className="text-xs text-center text-muted-foreground">
                  Sign in or create an account to accept this invitation.
                </p>
                <Link
                  href={`/login?redirect=/invite/${encodeURIComponent(token)}`}
                  className="w-full block"
                >
                  <Button className="w-full text-xs font-semibold gap-2">
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Accept</span>
                  </Button>
                </Link>
                <Link
                  href={`/register?redirect=/invite/${encodeURIComponent(token)}`}
                  className="w-full block text-center"
                >
                  <Button variant="outline" className="w-full text-xs">
                    Create New Account
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleAccept}
                  disabled={accepting || Boolean(emailMismatch)}
                  className="w-full text-xs font-semibold gap-2"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Joining Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Accept & Join Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
