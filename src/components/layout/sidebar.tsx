"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Layers,
  LayoutGrid,
  Pin,
  Share2,
  Users,
  Settings,
  FileText,
  Code2,
  Image as ImageIcon,
  Music,
  Video,
  Link2,
  FileBox,
  ChevronDown,
  Sparkles,
  HardDrive,
  LogOut,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/auth-context";
import { useWorkspace } from "@/features/workspaces/workspace-context";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const navItems = [
    { id: "all", label: "Board", icon: LayoutGrid, href: "/" },
    { id: "pinned", label: "Pinned", icon: Pin, href: "/pinned" },
    { id: "shares", label: "Shared Links", icon: Share2, href: "/shared" },
    { id: "members", label: "Team", icon: Users, href: "/members" },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];

  const typeFilters = [
    { id: "text", label: "Text", icon: FileText, href: "/?type=text" },
    { id: "code", label: "Code", icon: Code2, href: "/?type=code" },
    { id: "link", label: "Links", icon: Link2, href: "/?type=link" },
    { id: "image", label: "Images", icon: ImageIcon, href: "/?type=image" },
    { id: "audio", label: "Audio", icon: Music, href: "/?type=audio" },
    { id: "video", label: "Video", icon: Video, href: "/?type=video" },
    { id: "file", label: "Files", icon: FileBox, href: "/?type=file" },
  ];

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Team Member";
  const userInitial = displayName.charAt(0).toUpperCase();

  const workspaceName = activeWorkspace?.name || "Personal Shelf";
  const workspaceRole = activeWorkspace?.role || "owner";

  const isNavActive = (id: string, href: string) => {
    if (id === "all") {
      return pathname === "/" && !typeParam;
    }
    if (id === "pinned") {
      return pathname === "/pinned";
    }
    if (id === "shares") {
      return pathname === "/shared" || pathname === "/shares";
    }
    if (id === "members") {
      return pathname === "/members";
    }
    if (id === "settings") {
      return pathname === "/settings";
    }
    return pathname === href;
  };

  const isTypeActive = (typeId: string) => {
    return pathname === "/" && typeParam === typeId;
  };

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-card/60 backdrop-blur-md select-none",
        className
      )}
    >
      {/* Brand & Version Badge */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-base font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
            SyncShelf
          </span>
        </Link>
        <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-mono px-1.5 py-0">
          v0.3
        </Badge>
      </div>

      {/* Active Workspace Selector Dropdown */}
      <div className="relative p-3 border-b border-border/70 shrink-0">
        <div
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-background/80 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate font-semibold text-foreground">{workspaceName}</span>
              <span className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                <span>{workspaceRole}</span>
                <span>&bull;</span>
                <span>{activeWorkspace?.memberCount || 1} {((activeWorkspace?.memberCount || 1) === 1) ? "member" : "members"}</span>
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1 transition-transform",
              dropdownOpen && "rotate-180"
            )}
          />
        </div>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute left-3 right-3 top-14 z-50 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-50 zoom-in-95">
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces ({workspaces.length})
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      selectWorkspace(ws.id);
                      setDropdownOpen(false);
                      onNavigate?.();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="truncate">
                      <div className="truncate">{ws.name}</div>
                      <div
                        className={cn(
                          "text-[10px] capitalize",
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {ws.role}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 space-y-6 overflow-y-auto p-3">
        {/* Core Workspace Routes */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Workspace
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.id, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content Type Filter Shelf */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Filter Shelf
          </div>
          <nav className="space-y-0.5">
            {typeFilters.map((type) => {
              const Icon = type.icon;
              const active = isTypeActive(type.id);
              return (
                <Link
                  key={type.id}
                  href={type.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                    active
                      ? "bg-secondary text-secondary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{type.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Storage & User Status Footer */}
      <div className="border-t border-border p-3 space-y-3 bg-muted/20 shrink-0">
        {/* Storage Cap Usage Indicator */}
        <div className="rounded-lg border border-border/60 bg-card p-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="h-3 w-3 text-muted-foreground" /> File Storage
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Max 25 MB / file</span>
          </div>
        </div>

        {/* User Card & Sign Out */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {userInitial}
            </div>
            <div className="truncate text-xs">
              <div className="font-medium text-foreground truncate">{displayName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email || "Signed In"}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
