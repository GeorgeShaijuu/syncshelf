"use client";

import * as React from "react";
import { Users, Eye, Edit3, Calendar, Layers } from "lucide-react";
import { CollaboratorPresence } from "./presence-types";
import { cn } from "@/lib/utils";

interface CollaboratorAvatarStackProps {
  collaborators: CollaboratorPresence[];
  className?: string;
}

const PASTEL_PALETTE = [
  { bg: "bg-[#FFE4D0]", text: "text-[#F58B35]", border: "border-[#F5C6A3]" },
  { bg: "bg-[#E8DEF8]", text: "text-[#6750A4]", border: "border-[#D0BCFF]" },
  { bg: "bg-[#D0F0FD]", text: "text-[#0284C7]", border: "border-[#BAE6FD]" },
  { bg: "bg-[#FEF7CD]", text: "text-[#CA8A04]", border: "border-[#FEF08A]" },
  { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", border: "border-[#BBF7D0]" },
];

export function CollaboratorAvatarStack({
  collaborators,
  className,
}: CollaboratorAvatarStackProps) {
  const [hoveredUser, setHoveredUser] = React.useState<CollaboratorPresence | null>(null);

  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, 3);
  const overflowCount = Math.max(0, collaborators.length - 3);

  return (
    <div className={cn("relative flex items-center -space-x-2 select-none", className)}>
      {visibleCollaborators.map((c, idx) => {
        const color = PASTEL_PALETTE[idx % PASTEL_PALETTE.length];
        const initial = c.displayName.trim().charAt(0).toUpperCase() || "?";

        return (
          <div
            key={c.userId}
            className="relative group cursor-pointer"
            onMouseEnter={() => setHoveredUser(c)}
            onMouseLeave={() => setHoveredUser(null)}
          >
            {/* Avatar Circle */}
            <div
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#FAF7F0] shadow-sm transition-transform duration-150 group-hover:scale-110 group-hover:z-30 overflow-hidden font-bold text-xs",
                color.bg,
                color.text
              )}
            >
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatarUrl}
                  alt={c.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}

              {/* Active Green Dot */}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#22C55E] ring-1.5 ring-white" />
            </div>

            {/* Hover Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="clay-surface px-3 py-2 rounded-xl text-xs shadow-lg border border-[#EDE5D9] bg-[#FFFEFA] min-w-[130px] space-y-1 text-center">
                <p className="font-bold text-[#24211F] truncate">{c.displayName}</p>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#817A72]">
                  {c.view === "calendar" ? (
                    <>
                      <Calendar className="h-3 w-3 text-[#F58B35]" />
                      <span>Viewing Calendar</span>
                    </>
                  ) : (
                    <>
                      <Layers className="h-3 w-3 text-[#F58B35]" />
                      <span>Viewing Board</span>
                    </>
                  )}
                </div>
                <div className="pt-0.5">
                  <span
                    className={cn(
                      "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                      c.role === "owner"
                        ? "bg-[#FFE8D6] text-[#A65E26]"
                        : c.role === "editor"
                        ? "bg-[#E8DEF8] text-[#6750A4]"
                        : "bg-[#F3EFEA] text-[#817A72]"
                    )}
                  >
                    {c.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div
          title={`${overflowCount} more active collaborator${overflowCount > 1 ? "s" : ""}`}
          className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#FAF7F0] bg-[#F5EFE5] text-[#817A72] text-[10px] font-bold shadow-sm cursor-default"
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
