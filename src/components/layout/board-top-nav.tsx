"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Hand,
  Scan,
  Bookmark,
  RotateCw,
  Layers,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { useBoard } from "@/features/clipboard/board/board-context";
import { cn } from "@/lib/utils";

interface BoardTopNavProps {
  syncState?: "live" | "syncing" | "offline" | "error";
  lastSyncedAt?: Date | null;
}

export function BoardTopNav({ syncState = "live", lastSyncedAt }: BoardTopNavProps) {
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();
  const {
    searchQuery,
    setSearchQuery,
    activeTool,
    toggleHandTool,
    toggleSelectTool,
    isBookmarkOnly,
    toggleBookmarkOnly,
  } = useBoard();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const workspaceMenuRef = React.useRef<HTMLDivElement | null>(null);
  const workspaceTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Sync local search when context changes externally
  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce updating BoardContext searchQuery to prevent re-render thrashing across lanes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Close workspace dropdown on outside click or escape
  React.useEffect(() => {
    if (!workspaceMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(e.target as Node) &&
        workspaceTriggerRef.current &&
        !workspaceTriggerRef.current.contains(e.target as Node)
      ) {
        setWorkspaceMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWorkspaceMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspaceMenuOpen]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInput) return;

      if (e.key.toLowerCase() === "h") {
        toggleHandTool();
      } else if (e.key.toLowerCase() === "v") {
        toggleSelectTool();
      } else if (e.key.toLowerCase() === "b") {
        toggleBookmarkOnly();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleHandTool, toggleSelectTool, toggleBookmarkOnly]);

  const workspaceName = activeWorkspace?.name || "My Workspace";

  return (
    <header className="relative z-20 flex h-16 w-full items-center justify-between px-6 pt-3 select-none">
      {/* Left: Logo + Search Field */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        {/* 1. SyncShelf Logo */}
        <Link href="/" className="shrink-0 group flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#24211F] font-sans group-hover:opacity-85 transition-opacity">
            syncshelf
          </span>
        </Link>

        {/* 2. Rounded Search Bar with Tactile Inset Depth */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#817A72] stroke-[2]" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search anything..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="clay-inset w-full h-9 pl-9 pr-8 text-xs font-medium rounded-full text-[#24211F] placeholder:text-[#AAA197] focus:outline-none focus:bg-[#FFFEFA] transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch("");
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#817A72] hover:text-[#24211F] active:scale-90 transition-transform cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center Tool Group: Hand Tool → Select Tool → Bookmark → Sync */}
      <div className="flex items-center gap-2.5">
        {/* 3. Hand Tool */}
        <button
          type="button"
          onClick={toggleHandTool}
          title="Hand tool — pan the board (H)"
          className={cn(
            "clay-icon-btn flex h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer active:scale-90",
            activeTool === "hand"
              ? "bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_2px_8px_rgba(245,139,53,0.22),inset_0_1px_1px_rgba(255,255,255,0.9)] scale-105"
              : "bg-transparent text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
          )}
        >
          <Hand className="h-4 w-4 stroke-[1.8]" />
        </button>

        {/* 4. Select Tool (Viewfinder / Scan icon) */}
        <button
          type="button"
          onClick={toggleSelectTool}
          title="Select tool — select multiple items (V)"
          className={cn(
            "clay-icon-btn flex h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer active:scale-90",
            activeTool === "select"
              ? "bg-[#24211F] text-[#FFFEFA] border border-black/30 shadow-[0_3px_10px_rgba(0,0,0,0.25)] scale-105"
              : "bg-transparent text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
          )}
        >
          <Scan className="h-4 w-4 stroke-[1.8]" />
        </button>

        {/* 5. Bookmark Tool */}
        <button
          type="button"
          onClick={toggleBookmarkOnly}
          title={isBookmarkOnly ? "Show all items (B)" : "Filter to bookmarked items only (B)"}
          className={cn(
            "clay-icon-btn flex h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer active:scale-90",
            isBookmarkOnly
              ? "bg-gradient-to-b from-[#FFE085] to-[#FFD36C] text-[#24211F] border border-[#F0C050] shadow-[0_2px_8px_rgba(255,211,108,0.35),inset_0_1px_1px_rgba(255,255,255,0.9)] scale-105"
              : "bg-transparent text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
          )}
        >
          <Bookmark className={cn("h-4 w-4 stroke-[1.8]", isBookmarkOnly && "fill-current text-[#24211F]")} />
        </button>

        {/* 6. Sync Indicator Tool */}
        <div
          title={
            lastSyncedAt
              ? `Realtime active. Last updated at ${lastSyncedAt.toLocaleTimeString()}`
              : "Realtime synchronization active"
          }
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#817A72] transition-all cursor-default"
        >
          <RotateCw
            className={cn(
              "h-4 w-4 stroke-[1.8] transition-transform",
              syncState === "syncing" && "animate-spin text-[#F58B35]"
            )}
          />
        </div>
      </div>

      {/* Far Right: Workspace Selector with Elevated Pill */}
      <div className="relative shrink-0">
        <button
          ref={workspaceTriggerRef}
          type="button"
          onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
          className="clay-btn-secondary flex items-center gap-2 h-9 px-4 text-xs font-bold text-[#24211F] active:scale-95 transition-all cursor-pointer"
        >
          <Layers className="h-3.5 w-3.5 text-[#24211F]" />
          <span>{workspaceName}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[#817A72] ml-0.5 transition-transform duration-200",
              workspaceMenuOpen && "rotate-180"
            )}
          />
        </button>

        {/* Workspace Dropdown Menu */}
        {workspaceMenuOpen && (
          <div
            ref={workspaceMenuRef}
            className="absolute right-0 top-11 z-50 w-60 rounded-2xl border border-[#EDE5D9] bg-[#FFFEFA] p-2 shadow-[0_14px_36px_rgba(36,33,31,0.12),0_4px_12px_rgba(36,33,31,0.06),inset_0_1px_1px_rgba(255,255,255,1)] animate-pop-in"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-[#817A72] uppercase tracking-wider">
              Workspaces ({workspaces.length})
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin">
              {workspaces.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      selectWorkspace(ws.id);
                      setWorkspaceMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#24211F] text-[#FFFEFA] font-medium"
                        : "text-[#24211F] hover:bg-[#F5EFE5]"
                    )}
                  >
                    <div className="truncate">
                      <div className="truncate font-medium">{ws.name}</div>
                      <div
                        className={cn(
                          "text-[10px] capitalize",
                          isSelected ? "text-gray-300" : "text-[#817A72]"
                        )}
                      >
                        {ws.role} • {ws.memberCount || 1} {ws.memberCount === 1 ? "member" : "members"}
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
    </header>
  );
}
