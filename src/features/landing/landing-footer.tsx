"use client";

import * as React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-[#F0E5D8] bg-[#FFF8F0]/90 py-12 px-6 sm:px-10 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo and Tagline */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <div className="absolute top-1.5 left-0 w-5 h-3.5 rounded-md bg-[#F58B35] opacity-70 transform -rotate-6" />
              <div className="absolute top-1 left-0.5 w-5 h-3.5 rounded-md bg-[#EE624E] opacity-90 transform rotate-2" />
              <div className="absolute top-0 left-1 w-5 h-3.5 rounded-md bg-gradient-to-r from-[#F99849] to-[#E95E48] border border-white/60 shadow-xs transform -rotate-1" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#2D1C1B]">
              syncshelf
            </span>
          </Link>
          <span className="hidden sm:inline text-xs text-[#A89895]">&bull;</span>
          <span className="text-xs text-[#736360]">
            The collaborative content hub for teams and creators.
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-[#5C4D4B]">
          <a href="#features" className="hover:text-[#E95E48] transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-[#E95E48] transition-colors">
            Pricing
          </a>
          <a href="#about" className="hover:text-[#E95E48] transition-colors">
            About
          </a>
          <Link href="/login" className="hover:text-[#E95E48] transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="hover:text-[#E95E48] transition-colors">
            Register
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-xs text-[#9C8B88]">
          &copy; {new Date().getFullYear()} SyncShelf. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
