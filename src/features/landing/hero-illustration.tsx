"use client";

import * as React from "react";
import Image from "next/image";
import { Link2, Code2, Image as ImageIcon, Sparkles } from "lucide-react";

export function HeroIllustration() {
  return (
    <div className="relative w-full max-w-[580px] mx-auto flex items-center justify-center select-none pt-4 pb-2">
      {/* Background Soft Organic Radial Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#FFDFCB]/50 via-[#FFEFE5]/40 to-transparent rounded-full blur-2xl transform scale-110 pointer-events-none" />

      {/* Main Illustration Canvas Wrapper */}
      <div className="relative w-full aspect-[4/3.7] sm:aspect-[4/3.5] flex items-center justify-center">

        {/* 1. Miniature 3D Board Canvas Preview (Backdrop Board) */}
        <div className="absolute top-2 left-2 sm:left-4 right-10 sm:right-14 h-[75%] rounded-[28px] sm:rounded-[36px] bg-[#FFFBF6] border-2 border-[#EFE5D8] shadow-[0_20px_50px_rgba(45,28,27,0.08),inset_0_2px_4px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(225,215,200,0.3)] overflow-hidden p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3 transition-transform">
          {/* Board Top Nav Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-[#F2E8DC]">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-gradient-to-tr from-[#F58B35] to-[#EE624E] shadow-2xs" />
              <span className="text-[11px] sm:text-xs font-bold text-[#2D1C1B] tracking-tight">
                syncshelf
              </span>
            </div>
            {/* Top mini tools */}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#E8DDD0]" />
              <div className="w-2 h-2 rounded-full bg-[#E8DDD0]" />
              <div className="w-2 h-2 rounded-full bg-[#E8DDD0]" />
            </div>
          </div>

          {/* Board Body: Mini Sidebar + Lanes */}
          <div className="flex flex-1 gap-2.5 sm:gap-3 overflow-hidden">
            {/* Mini sidebar icons */}
            <div className="w-5 sm:w-6 flex flex-col items-center gap-2 pt-1 border-r border-[#F4ECE2]">
              <div className="w-3.5 h-3.5 rounded-full bg-[#FFE5D2] text-[#F58B35] flex items-center justify-center shadow-2xs" />
              <div className="w-3.5 h-3.5 rounded-full bg-[#F5EFE6]" />
              <div className="w-3.5 h-3.5 rounded-full bg-[#F5EFE6]" />
            </div>

            {/* Mini Lanes Preview (3 columns) */}
            <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-2.5 h-full">
              {/* Lane 1: Image & Text */}
              <div className="flex flex-col gap-2 rounded-xl bg-[#F7F1E8]/70 p-1.5 sm:p-2 border border-[#EBE1D3]">
                <div className="h-1.5 w-10 bg-[#D8CCC0] rounded-full" />
                {/* Clay Image Card (Yellow/Peach Sunset) */}
                <div className="rounded-lg bg-gradient-to-b from-[#FFE3A8] to-[#FFCF7A] border border-[#F5BE58] p-2 flex flex-col items-center justify-center gap-1 shadow-2xs aspect-video">
                  <div className="w-4 h-4 rounded-full bg-[#FFF1D1] shadow-xs" />
                  <div className="w-full h-1.5 bg-[#E6A935]/40 rounded-full" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-[#E2D7CC] rounded-full" />
                  <div className="h-1.5 w-2/3 bg-[#E2D7CC] rounded-full" />
                </div>
              </div>

              {/* Lane 2: Lavender Code Block */}
              <div className="flex flex-col gap-2 rounded-xl bg-[#F7F1E8]/70 p-1.5 sm:p-2 border border-[#EBE1D3]">
                <div className="h-1.5 w-8 bg-[#D8CCC0] rounded-full" />
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-[#E2D7CC] rounded-full" />
                  <div className="h-1.5 w-4/5 bg-[#E2D7CC] rounded-full" />
                </div>
                {/* Lavender Card */}
                <div className="rounded-lg bg-gradient-to-b from-[#EFE6FF] to-[#DFCEFF] border border-[#CCA7FF] p-2 flex flex-col gap-1 shadow-2xs">
                  <div className="h-1 w-6 bg-[#A37AFF] rounded-full" />
                  <div className="h-1 w-full bg-[#C2A5FF] rounded-full" />
                  <div className="h-1 w-3/4 bg-[#C2A5FF] rounded-full" />
                </div>
              </div>

              {/* Lane 3: Notes & Links */}
              <div className="flex flex-col gap-2 rounded-xl bg-[#F7F1E8]/70 p-1.5 sm:p-2 border border-[#EBE1D3]">
                <div className="h-1.5 w-12 bg-[#D8CCC0] rounded-full" />
                <div className="rounded-lg bg-white border border-[#E8DFD3] p-1.5 space-y-1 shadow-2xs">
                  <div className="h-1.5 w-full bg-[#E2D7CC] rounded-full" />
                  <div className="h-1.5 w-3/4 bg-[#E2D7CC] rounded-full" />
                </div>
                <div className="rounded-lg bg-white border border-[#E8DFD3] p-1.5 space-y-1 shadow-2xs">
                  <div className="h-1.5 w-full bg-[#E2D7CC] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Miniature Calendar Card (Tucked Behind Board on the Right) */}
        <div className="absolute top-8 right-1 sm:right-3 w-28 sm:w-36 rounded-2xl sm:rounded-3xl bg-[#FFFEFB] border-2 border-[#EFE5D8] shadow-[0_12px_32px_rgba(45,28,27,0.1),inset_0_1px_2px_rgba(255,255,255,0.95)] p-2.5 sm:p-3 flex flex-col gap-1.5 z-10 transform rotate-1">
          <div className="flex items-center justify-between pb-1 border-b border-[#F0E6DA]">
            <div className="h-1.5 w-8 bg-[#D8CCC0] rounded-full" />
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F58B35]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#E8DDD0]" />
            </div>
          </div>
          {/* Mini Month Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm sm:rounded flex items-center justify-center text-[7px] ${
                  i === 11
                    ? "bg-[#F58B35] text-white font-bold shadow-2xs"
                    : i === 18
                    ? "bg-[#FFE2CF] text-[#A65E26]"
                    : "bg-[#F4EFE6]/80"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Decorative Top-Right Sunburst Rays */}
        <div className="absolute top-0 right-8 sm:right-12 z-20 flex gap-1 pointer-events-none opacity-80">
          <div className="w-1 h-3.5 bg-[#FFBF75] rounded-full transform -rotate-25 shadow-xs" />
          <div className="w-1 h-4 bg-[#FFA84D] rounded-full -translate-y-1 shadow-xs" />
          <div className="w-1 h-3.5 bg-[#FFBF75] rounded-full transform rotate-25 shadow-xs" />
        </div>

        {/* 3. Floating Clay Tiles */}
        {/* Floating Orange Link Tile (Left) */}
        <div className="absolute top-44 sm:top-48 left-12 sm:left-18 z-30 transform -rotate-12 hover:rotate-0 transition-transform cursor-pointer">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#FFEBDC] to-[#FFD5BA] border-2 border-[#F7B686] shadow-[0_8px_20px_rgba(245,139,53,0.32),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(220,130,60,0.25)] flex items-center justify-center">
            <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-[#E06A26] stroke-[2.4]" />
          </div>
        </div>

        {/* Floating Lavender Code Tile (Right) */}
        <div className="absolute top-36 sm:top-40 right-2 sm:right-6 z-30 transform rotate-12 hover:rotate-0 transition-transform cursor-pointer">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#F3ECFF] to-[#E3D2FF] border-2 border-[#C6A3FF] shadow-[0_8px_20px_rgba(168,122,255,0.3),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(150,90,240,0.25)] flex items-center justify-center">
            <Code2 className="h-5 w-5 sm:h-6 sm:w-6 text-[#7E42EA] stroke-[2.4]" />
          </div>
        </div>

        {/* 4. Foreground: 3D Circular Peach Clay Pedestal */}
        <div className="absolute bottom-2 sm:bottom-4 right-10 sm:right-16 z-20 flex flex-col items-center">
          {/* Circular Pedestal Disc */}
          <div className="relative w-44 sm:w-56 h-10 sm:h-12 rounded-[50%] bg-gradient-to-b from-[#FFE2D0] via-[#FDC6A5] to-[#F5A57A] border-2 border-[#F59868] shadow-[0_14px_28px_rgba(220,110,50,0.35),inset_0_2px_4px_rgba(255,255,255,0.85),inset_0_-4px_6px_rgba(190,85,30,0.3)] flex items-center justify-center">
            {/* Inner rim highlight */}
            <div className="w-[92%] h-[75%] rounded-[50%] bg-gradient-to-b from-[#FFF0E6] to-[#FEDBC7] opacity-80" />
          </div>
        </div>

        {/* 5. Cat Mascot sitting proudly on the pedestal */}
        <div className="absolute bottom-6 sm:bottom-8 right-12 sm:right-18 z-30 w-44 sm:w-56 flex justify-center pointer-events-none">
          <Image
            src="/animations/loading_main_poster.png"
            alt="SyncShelf Mascot"
            width={280}
            height={295}
            priority
            className="w-full h-auto max-h-[220px] sm:max-h-[280px] object-contain drop-shadow-[0_12px_24px_rgba(60,35,25,0.18)]"
          />
        </div>

      </div>
    </div>
  );
}
