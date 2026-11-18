"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  Plus,
  Radio,
  Menu,
  Command,
  ClipboardPaste,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopNavProps {
  onToggleMobileMenu?: () => void;
  onOpenQuickCapture?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function TopNav({
  onToggleMobileMenu,
  onOpenQuickCapture,
  searchQuery = "",
  onSearchChange,
}: TopNavProps) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    if (path === "/pinned") return "Pinned";
    if (path === "/shared" || path === "/shares") return "Shared Links";
    if (path === "/members") return "Team";
    if (path === "/settings") return "Settings";
    return "Board";
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      {/* Left: Mobile trigger & breadcrumb / search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 text-muted-foreground"
          onClick={onToggleMobileMenu}
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Dynamic Route Breadcrumb */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 select-none">
          <span className="font-medium text-muted-foreground">Workspace</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">{pageTitle}</span>
        </div>

        {/* Global Search Bar (available if handler provided) */}
        {onSearchChange && (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search snippets, code, tags, links..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-full pl-8 pr-12 text-xs bg-muted/40 focus-visible:bg-background transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono bg-background/80 px-1.5 py-0.5 rounded border border-border">
              <Command className="h-2.5 w-2.5 mr-0.5" />
              <span>K</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Sync Status & Quick Capture */}
      <div className="flex items-center gap-2.5 ml-4">
        {/* Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span className="font-medium">In Sync</span>
        </div>

        {/* Quick Capture Button */}
        <Button
          size="sm"
          onClick={onOpenQuickCapture}
          className="h-8 gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Capture</span>
        </Button>
      </div>
    </header>
  );
}
