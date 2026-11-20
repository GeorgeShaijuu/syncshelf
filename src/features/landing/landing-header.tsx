"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { ClayButton } from "@/components/ui/clay";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#FFF8F0]/85 border-b border-[#F0E5D8]/80 transition-all select-none">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          {/* 3-layer clay stack icon */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Layer 1 (bottom) */}
            <div className="absolute top-2 left-0 w-6 h-4 rounded-md bg-[#F58B35] opacity-70 transform -rotate-6 shadow-xs" />
            {/* Layer 2 (middle) */}
            <div className="absolute top-1 left-1 w-6 h-4 rounded-md bg-[#EE624E] opacity-90 transform rotate-2 shadow-xs" />
            {/* Layer 3 (top) */}
            <div className="absolute top-0 left-1.5 w-6 h-4 rounded-md bg-gradient-to-r from-[#F99849] to-[#E95E48] border border-white/60 shadow-[0_2px_6px_rgba(233,94,72,0.3)] transform -rotate-1 group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-[#2D1C1B] font-sans">
            syncshelf
          </span>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5C4D4B]">
          <a
            href="#features"
            className="hover:text-[#E95E48] transition-colors cursor-pointer"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hover:text-[#E95E48] transition-colors cursor-pointer"
          >
            Pricing
          </a>
          <a
            href="#about"
            className="hover:text-[#E95E48] transition-colors cursor-pointer"
          >
            About
          </a>
        </nav>

        {/* Right CTA Actions (Desktop) */}
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/login">
            <button
              type="button"
              className="px-5 py-2 rounded-full text-sm font-semibold text-[#2D1C1B] bg-[#FFFBF5] border border-[#EADCCF] shadow-[0_2px_6px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:bg-white hover:border-[#DFCFC0] active:scale-95 transition-all cursor-pointer"
            >
              Sign In
            </button>
          </Link>

          <Link href="/register">
            <button
              type="button"
              className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#EA543D] to-[#E95E48] border border-[#D94F3C] shadow-[0_4px_14px_rgba(233,94,72,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              Get Started
            </button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-xl text-[#2D1C1B] hover:bg-[#F2E8DC] transition-colors"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Panel */}
      {mobileMenuOpen && (
        <div className="sm:hidden px-6 pb-6 pt-2 bg-[#FFF8F0] border-b border-[#F0E5D8] space-y-4 animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-3 font-semibold text-sm text-[#5C4D4B]">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#E95E48] transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#E95E48] transition-colors"
            >
              Pricing
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#E95E48] transition-colors"
            >
              About
            </a>
          </nav>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link href="/login" className="w-full">
              <button
                type="button"
                className="w-full py-2.5 rounded-full text-sm font-semibold text-[#2D1C1B] bg-[#FFFBF5] border border-[#EADCCF] shadow-xs"
              >
                Sign In
              </button>
            </Link>
            <Link href="/register" className="w-full">
              <button
                type="button"
                className="w-full py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#EA543D] to-[#E95E48] border border-[#D94F3C] shadow-sm"
              >
                Get Started
              </button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
