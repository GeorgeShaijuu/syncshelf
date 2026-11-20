"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Link2, Code2, Users, Calendar as CalendarIcon, Image as ImageIcon } from "lucide-react";

export function FeatureCards() {
  return (
    <section id="features" className="relative z-10 py-16 sm:py-24 max-w-7xl mx-auto px-6 sm:px-10 select-none">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        {/* Eyebrow */}
        <div className="inline-flex items-center justify-center gap-3 text-xs font-bold tracking-widest text-[#9C8B88] uppercase">
          <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
          <span>WHAT YOU CAN DO</span>
          <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#2D1C1B] leading-tight">
          A smarter space for your clipped content
        </h2>
      </div>

      {/* 3-Column Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-14">

        {/* ========================================================
            CARD 1: Capture & Organise
            ======================================================== */}
        <div className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF9] to-[#FFF7EE] border border-[#EFE5D8] p-7 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(225,215,200,0.25)] hover:shadow-[0_16px_40px_rgba(45,28,27,0.08),inset_0_1px_1px_rgba(255,255,255,1)] hover:-translate-y-1 transition-all duration-200">
          <div>
            {/* Top Illustration Area */}
            <div className="h-40 w-full rounded-2xl bg-[#FFF8F0]/60 flex items-center justify-center relative overflow-hidden mb-6">
              {/* Soft background glow */}
              <div className="absolute w-28 h-28 rounded-full bg-[#FFE5D2]/50 blur-xl" />

              {/* Clay Floating Tiles */}
              <div className="relative flex items-center justify-center gap-2">
                {/* Tile 1: Orange 'T' (Text) Tile */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FFEBDC] to-[#FFD5BA] border-2 border-[#F7B686] shadow-[0_6px_16px_rgba(245,139,53,0.25),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(215,120,50,0.2)] flex items-center justify-center transform -rotate-8 group-hover:-rotate-12 transition-transform">
                  <span className="text-2xl font-black text-[#D46320] font-sans">
                    T
                  </span>
                </div>

                {/* Tile 2: Peach Picture Tile (Image) */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#FFDFCA] to-[#FFC5A4] border-2 border-[#F8A779] shadow-[0_8px_20px_rgba(245,120,60,0.28),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(200,90,40,0.2)] flex items-center justify-center transform rotate-2 z-10 group-hover:scale-105 transition-transform p-3">
                  {/* Miniature landscape graphic */}
                  <div className="w-full h-full rounded-lg bg-[#FFEAD9] flex flex-col justify-end items-center overflow-hidden relative">
                    <div className="absolute top-1 right-1.5 w-2.5 h-2.5 rounded-full bg-[#F58B35]" />
                    <div className="w-7 h-5 rounded-t-full bg-[#E87343] -mb-1" />
                  </div>
                </div>

                {/* Tile 3: Lavender '</>' (Code) Tile */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#F3ECFF] to-[#E3D2FF] border-2 border-[#C6A3FF] shadow-[0_6px_16px_rgba(168,122,255,0.25),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(150,90,240,0.2)] flex items-center justify-center transform rotate-10 group-hover:rotate-14 transition-transform">
                  <Code2 className="h-6 w-6 text-[#7E42EA] stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-[#2D1C1B] tracking-tight">
              Capture &amp; Organise
            </h3>
            <p className="text-sm text-[#736360] leading-relaxed mt-2.5">
              Save text, code, links, images and files, automatically sorted into clean, visual lanes.
            </p>
          </div>

          {/* Bottom Right Circular Action */}
          <div className="flex justify-end pt-6">
            <Link
              href="/register"
              className="h-9 w-9 rounded-full bg-[#FFEFE6] text-[#E95E48] hover:bg-[#E95E48] hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs group-hover:scale-105 active:scale-95"
              aria-label="Get started with Capture & Organise"
            >
              <ArrowRight className="h-4 w-4 stroke-[2.2]" />
            </Link>
          </div>
        </div>

        {/* ========================================================
            CARD 2: Share & Collaborate
            ======================================================== */}
        <div className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF9] to-[#FFF7EE] border border-[#EFE5D8] p-7 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(225,215,200,0.25)] hover:shadow-[0_16px_40px_rgba(45,28,27,0.08),inset_0_1px_1px_rgba(255,255,255,1)] hover:-translate-y-1 transition-all duration-200">
          <div>
            {/* Top Illustration Area */}
            <div className="h-40 w-full rounded-2xl bg-[#FFF8F0]/60 flex items-center justify-center relative overflow-hidden mb-6">
              {/* Soft background glow */}
              <div className="absolute w-28 h-28 rounded-full bg-[#FFE5D2]/50 blur-xl" />

              {/* Clay People Pill + Link Badge */}
              <div className="relative flex items-center justify-center">
                {/* 3D Clay Pill with Two Avatars */}
                <div className="w-28 h-18 rounded-[28px] bg-gradient-to-b from-[#FFE8D6] to-[#FED2B7] border-2 border-[#FCAE85] shadow-[0_8px_20px_rgba(245,139,53,0.26),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(215,110,45,0.25)] flex items-center justify-center gap-3 p-3 group-hover:scale-105 transition-transform">
                  {/* Left avatar clay bust */}
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-[#F58B35] shadow-2xs" />
                    <div className="w-8 h-4 rounded-t-full bg-[#F58B35] mt-0.5 shadow-2xs" />
                  </div>
                  {/* Right avatar clay bust */}
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-[#F58B35] shadow-2xs" />
                    <div className="w-8 h-4 rounded-t-full bg-[#F58B35] mt-0.5 shadow-2xs" />
                  </div>
                </div>

                {/* Floating Coral Link Circle Badge */}
                <div className="absolute -bottom-1 -right-2 w-9 h-9 rounded-full bg-gradient-to-b from-[#FF765C] to-[#E95E48] border-2 border-white shadow-[0_4px_12px_rgba(233,94,72,0.4),inset_0_1px_2px_rgba(255,255,255,0.6)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Link2 className="h-4 w-4 text-white stroke-[2.4]" />
                </div>
              </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-[#2D1C1B] tracking-tight">
              Share &amp; Collaborate
            </h3>
            <p className="text-sm text-[#736360] leading-relaxed mt-2.5">
              Work together in real time with secure, flexible sharing controls for your team or clients.
            </p>
          </div>

          {/* Bottom Right Circular Action */}
          <div className="flex justify-end pt-6">
            <Link
              href="/register"
              className="h-9 w-9 rounded-full bg-[#FFEFE6] text-[#E95E48] hover:bg-[#E95E48] hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs group-hover:scale-105 active:scale-95"
              aria-label="Get started with Share & Collaborate"
            >
              <ArrowRight className="h-4 w-4 stroke-[2.2]" />
            </Link>
          </div>
        </div>

        {/* ========================================================
            CARD 3: Plan & Stay in Sync
            ======================================================== */}
        <div className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF9] to-[#FFF7EE] border border-[#EFE5D8] p-7 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(225,215,200,0.25)] hover:shadow-[0_16px_40px_rgba(45,28,27,0.08),inset_0_1px_1px_rgba(255,255,255,1)] hover:-translate-y-1 transition-all duration-200">
          <div>
            {/* Top Illustration Area */}
            <div className="h-40 w-full rounded-2xl bg-[#FFF8F0]/60 flex items-center justify-center relative overflow-hidden mb-6">
              {/* Soft background glow */}
              <div className="absolute w-28 h-28 rounded-full bg-[#FFE5D2]/50 blur-xl" />

              {/* 3D Clay Calendar Widget */}
              <div className="relative w-22 h-24 rounded-2xl bg-[#FFFEFB] border-2 border-[#EFE5D8] shadow-[0_10px_24px_rgba(45,28,27,0.08),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(225,215,200,0.3)] overflow-hidden flex flex-col group-hover:scale-105 transition-transform">
                {/* Top Binder Header (Orange) */}
                <div className="h-6 w-full bg-gradient-to-r from-[#F99849] to-[#F58B35] relative flex items-center justify-around px-3">
                  {/* Mini Binder Ring Pegs */}
                  <div className="w-2 h-3 -mt-1.5 rounded-full bg-gradient-to-b from-[#FFF1E0] to-[#E5975A] border border-[#D97C3A] shadow-2xs" />
                  <div className="w-2 h-3 -mt-1.5 rounded-full bg-gradient-to-b from-[#FFF1E0] to-[#E5975A] border border-[#D97C3A] shadow-2xs" />
                </div>

                {/* Calendar Date Grid */}
                <div className="flex-1 p-2 grid grid-cols-4 gap-1.5 items-center justify-items-center">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  {/* Selected / Marked day (Coral) */}
                  <div className="w-3 h-3 rounded-md bg-gradient-to-b from-[#FF765C] to-[#E95E48] text-white shadow-2xs flex items-center justify-center font-bold text-[8px]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F5EFE6]" />
                </div>
              </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-[#2D1C1B] tracking-tight">
              Plan &amp; Stay in Sync
            </h3>
            <p className="text-sm text-[#736360] leading-relaxed mt-2.5">
              Turn your saved content into planned tasks and deadlines with a built-in calendar.
            </p>
          </div>

          {/* Bottom Right Circular Action */}
          <div className="flex justify-end pt-6">
            <Link
              href="/register"
              className="h-9 w-9 rounded-full bg-[#FFEFE6] text-[#E95E48] hover:bg-[#E95E48] hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs group-hover:scale-105 active:scale-95"
              aria-label="Get started with Plan & Stay in Sync"
            >
              <ArrowRight className="h-4 w-4 stroke-[2.2]" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
