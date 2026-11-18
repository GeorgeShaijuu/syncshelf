"use client";

import * as React from "react";
import Link from "next/link";
import {
  Share2,
  Clock,
  KeyRound,
  Eye,
  Sparkles,
  ArrowRight,
  Layers,
  Pin,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SharesComingSoonView() {
  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Share2 className="h-6 w-6 text-primary" />
            <span>Shared Links</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Publish and manage public, expiring share links for clipboard items and uploaded files.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-mono font-medium text-amber-500 border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5"
        >
          Milestone 9 &bull; Coming Soon
        </Badge>
      </div>

      {/* Main Feature Preview Card */}
      <div className="rounded-xl border border-border/80 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-6 sm:p-8 space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
          <Share2 className="h-7 w-7" />
        </div>

        <div className="max-w-xl mx-auto space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            Public Sharing is Arriving in Milestone 9
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Need to share a code snippet, design asset, or document with someone outside your workspace?
            Milestone 9 introduces granular, secure link generation without granting full workspace membership.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 text-left">
          <div className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>Auto-Expiration</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Set links to automatically expire after 1 hour, 24 hours, 7 days, or after a specific number of views.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Passkey Protected</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Protect sensitive clipboard content or private R2 documents with optional password gates.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Eye className="h-4 w-4 text-primary" />
              <span>Realtime Metrics</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Track view counts, download statistics, and instantly revoke active public links in one click.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button size="sm" className="gap-2 text-xs font-medium">
              <Layers className="h-3.5 w-3.5" />
              <span>Return to All Items</span>
            </Button>
          </Link>
          <Link href="/pinned">
            <Button size="sm" variant="outline" className="gap-2 text-xs font-medium">
              <Pin className="h-3.5 w-3.5" />
              <span>View Pinned Items</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Security Architecture Box */}
      <div className="p-4 rounded-xl border border-border/60 bg-muted/10 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">Zero Direct Workspace Exposure</span>
          <p className="text-[11px] leading-relaxed">
            Public share links will resolve through dedicated public endpoints using secure, signed tokens. External visitors will have zero read access to your workspace document, members list, or other clipboard items.
          </p>
        </div>
      </div>
    </div>
  );
}
