"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Upload,
  Layers,
  Users,
  Share2,
  Settings,
  Calendar,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useBoard } from "@/features/clipboard/board/board-context";
import { cn } from "@/lib/utils";

interface FloatingToolbarProps {
  onOpenCapture?: () => void;
  onTriggerUpload?: () => void;
}

export function FloatingToolbar({
  onOpenCapture,
  onTriggerUpload,
}: FloatingToolbarProps) {
  const { user, signOut } = useAuth();
  const { setQuickCaptureOpen } = useBoard();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Close profile dropdown on outside click or escape
  React.useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  const handleCapture = () => {
    if (onOpenCapture) {
      onOpenCapture();
    } else {
      setQuickCaptureOpen(true);
    }
  };

  const navItems = [
    {
      label: "Board Canvas",
      icon: Layers,
      href: "/",
      isActive: pathname === "/",
    },
    {
      label: "Team Members",
      icon: Users,
      href: "/members",
      isActive: pathname === "/members",
    },
    {
      label: "Shared Links",
      icon: Share2,
      href: "/shared",
      isActive: pathname === "/shared",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      isActive: pathname === "/settings",
    },
    {
      label: "Calendar",
      icon: Calendar,
      href: "/calendar",
      isActive: pathname === "/calendar",
    },
  ];

  return (
    <aside className="fixed left-4 top-24 z-30 flex flex-col items-center justify-between w-12 py-3 px-1.5 rounded-2xl bg-[#FFFEFA]/95 backdrop-blur-md border border-[#EDE5D9] shadow-[0_12px_32px_rgba(36,33,31,0.08),0_2px_8px_rgba(36,33,31,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] select-none">
      {/* Top action icons */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* 1. Add / Quick Capture (Tangerine/Peach Clay Rounded Square) */}
        <button
          type="button"
          onClick={handleCapture}
          title="Add / Paste anything (Ctrl+V)"
          aria-label="Add or Paste Item"
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_2px_8px_rgba(245,139,53,0.2),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(230,160,110,0.25)] hover:scale-105 active:scale-90 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.2]" />
        </button>

        {/* 2. Upload Action */}
        <button
          type="button"
          onClick={onTriggerUpload}
          title="Upload files"
          aria-label="Upload files"
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5] active:scale-90 transition-all cursor-pointer"
        >
          <Upload className="h-4 w-4 stroke-[1.8]" />
        </button>

        {/* 3. Navigation Links */}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "group relative flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer active:scale-90",
                item.isActive
                  ? "bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_2px_6px_rgba(245,139,53,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] font-semibold"
                  : "text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]"
              )}
            >
              <Icon className="h-4 w-4 stroke-[1.8]" />
            </Link>
          );
        })}
      </div>

      {/* 4. Separator & User Profile Avatar at Bottom */}
      <div className="relative mt-2.5 pt-2.5 w-full flex flex-col items-center gap-2">
        <div className="w-5 h-[1px] bg-[#EDE5D9]" />

        <button
          ref={profileTriggerRef}
          type="button"
          onClick={() => setProfileOpen((prev) => !prev)}
          title={`Signed in as ${displayName}`}
          aria-label="User Profile"
          className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#F58B35] via-[#EE624E] to-[#FFD36C] text-white flex items-center justify-center font-bold text-[10px] shadow-[0_2px_6px_rgba(245,139,53,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:ring-2 hover:ring-[#F58B35]/40 active:scale-90 transition-all cursor-pointer"
        >
          {userInitial}
        </button>

        {/* Profile Popover */}
        {profileOpen && (
          <div
            ref={profileMenuRef}
            className="absolute left-14 bottom-0 z-50 w-56 rounded-2xl border border-[#E8E2D6] bg-[#FFFEFB] p-3 shadow-[0_12px_32px_rgba(20,15,10,0.12),0_4px_12px_rgba(20,15,10,0.06)] animate-pop-in"
          >
            <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-[#F0EBE1]">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#F28A32] via-[#E84B35] to-[#FFC84B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {userInitial}
              </div>
              <div className="truncate text-xs">
                <div className="font-semibold text-[#151515] truncate">{displayName}</div>
                <div className="text-[10.5px] text-[#77736D] truncate">{user?.email}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-[#E84B35] hover:bg-[#FFEBE8] transition-colors font-medium cursor-pointer active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
