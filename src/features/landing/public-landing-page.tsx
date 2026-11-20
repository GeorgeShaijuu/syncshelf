"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  Users,
  Calendar,
  ArrowRight,
  Play,
} from "lucide-react";
import { LandingHeader } from "./landing-header";
import { HeroIllustration } from "./hero-illustration";
import { FeatureCards } from "./feature-cards";
import { PricingAndAbout } from "./pricing-and-about";
import { LandingFooter } from "./landing-footer";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";

export function PublicLandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#FAF7F0] text-[#24211F] relative overflow-x-hidden selection:bg-[#FFE0CC] selection:text-[#E95E48]">
      {/* Corner Abstract Waves Artwork */}
      <OrganicBackgroundArtwork />

      {/* Top Navigation Bar */}
      <LandingHeader />

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 sm:pt-14 pb-12 sm:pb-20 select-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-7">
            {/* Pill Badge */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFEFE6] border border-[#FCD8C5] shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-[#E95E48]" />
                <span className="text-xs font-bold text-[#D95338] tracking-wide">
                  A collaborative content hub
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-[#2D1C1B] leading-[1.12]">
              Capture, organise,
              <br />
              and share your
              <br />
              ideas <span className="text-[#E95E48]">in sync.</span>
            </h1>

            {/* Subtitle Description */}
            <p className="text-base sm:text-lg text-[#6B5A57] leading-relaxed max-w-lg">
              Keep your text, code, links, images and files in one visual workspace
              — with real-time collaboration and a built-in calendar.
            </p>

            {/* 3 Feature Indicators Row */}
            <div className="flex flex-wrap items-center gap-5 sm:gap-6 pt-1 text-xs sm:text-sm font-bold text-[#4A3B39]">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#F58B35] fill-[#F58B35]" />
                <span>Real-time sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#E95E48]" />
                <span>Collaborative</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#F58B35]" />
                <span>Board &amp; Calendar</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link href="/register">
                <button
                  type="button"
                  className="px-7 py-3.5 rounded-full font-bold text-sm sm:text-base text-white bg-gradient-to-r from-[#EA543D] to-[#E95E48] border border-[#D94F3C] shadow-[0_8px_24px_rgba(233,94,72,0.38),inset_0_1px_1px_rgba(255,255,255,0.45)] hover:brightness-105 hover:scale-102 active:scale-98 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </button>
              </Link>

              <a href="#features">
                <button
                  type="button"
                  className="px-6 py-3.5 rounded-full font-bold text-sm sm:text-base text-[#4A3B39] bg-[#FFF8F2] border border-[#EADCCF] shadow-[0_3px_10px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white hover:border-[#DFCFC0] hover:scale-102 active:scale-98 transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-full bg-[#FFEAE0] text-[#E95E48] flex items-center justify-center">
                    <Play className="h-2.5 w-2.5 fill-[#E95E48] ml-0.5" />
                  </div>
                  <span>See How It Works</span>
                </button>
              </a>
            </div>
          </div>

          {/* Right Column: Hero Illustration Scene */}
          <div className="lg:col-span-6">
            <HeroIllustration />
          </div>

        </div>
      </main>

      {/* Feature Cards Section ("WHAT YOU CAN DO") */}
      <FeatureCards />

      {/* Pricing & About Sections */}
      <PricingAndAbout />

      {/* Minimal Footer */}
      <LandingFooter />
    </div>
  );
}
