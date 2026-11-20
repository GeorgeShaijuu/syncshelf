"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, Heart } from "lucide-react";

export function PricingAndAbout() {
  return (
    <>
      {/* ========================================================
          PRICING SECTION
          ======================================================== */}
      <section id="pricing" className="relative z-10 py-16 sm:py-20 max-w-7xl mx-auto px-6 sm:px-10 select-none">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center justify-center gap-3 text-xs font-bold tracking-widest text-[#9C8B88] uppercase">
            <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
            <span>TRANSPARENT PRICING</span>
            <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2D1C1B]">
            Start free, scale with your team
          </h2>
          <p className="text-sm sm:text-base text-[#736360]">
            No credit card required. Everything you need to capture and collaborate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Starter Plan (Free) */}
          <div className="relative rounded-3xl bg-[#FFFEFB] border-2 border-[#EFE5D8] p-8 sm:p-9 shadow-[0_12px_32px_rgba(45,28,27,0.04),inset_0_1px_1px_rgba(255,255,255,1)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#2D1C1B]">Starter</h3>
                <span className="text-xs font-bold text-[#D46320] bg-[#FFEBDC] px-3 py-1 rounded-full border border-[#F7B686]/60">
                  Popular
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black text-[#2D1C1B]">$0</span>
                <span className="text-sm text-[#736360]">/ forever</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#736360]">
                Perfect for personal knowledge, link hoarding, and small team boards.
              </p>

              <div className="mt-6 space-y-3 border-t border-[#F2EAE0] pt-6 text-xs sm:text-sm text-[#4A3B39]">
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#EBF7EE] text-[#2E7D32] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>1 Owned Board Canvas &amp; 7 Content Lanes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#EBF7EE] text-[#2E7D32] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Join Unlimited Shared Spaces</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#EBF7EE] text-[#2E7D32] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Live Realtime Collaboration &amp; Presence</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#EBF7EE] text-[#2E7D32] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Universal Paste &amp; Cloudflare R2 Uploads</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#EBF7EE] text-[#2E7D32] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Full Interactive Calendar View</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/register" className="w-full block">
                <button
                  type="button"
                  className="w-full py-3.5 rounded-full font-bold text-sm text-[#2D1C1B] bg-[#FFF8F0] border border-[#E8DFD3] hover:bg-white hover:border-[#DFD5C5] active:scale-98 transition-all shadow-xs cursor-pointer"
                >
                  Get Started Free
                </button>
              </Link>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#FFF9F3] to-[#FFF1E8] border-2 border-[#FCD8C5] p-8 sm:p-9 shadow-[0_16px_40px_rgba(233,94,72,0.1),inset_0_2px_3px_rgba(255,255,255,1)] flex flex-col justify-between">
            <div className="absolute -top-3.5 right-8">
              <div className="px-3.5 py-1 rounded-full bg-gradient-to-r from-[#EA543D] to-[#E95E48] text-white text-[11px] font-bold shadow-[0_2px_8px_rgba(233,94,72,0.4)] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                <span>Team Power</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#2D1C1B]">Pro Collective</h3>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black text-[#2D1C1B]">$8</span>
                <span className="text-sm text-[#736360]">/ member / mo</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#736360]">
                For growing studios, agencies, and cross-functional design teams.
              </p>

              <div className="mt-6 space-y-3 border-t border-[#F5DFD0] pt-6 text-xs sm:text-sm text-[#4A3B39]">
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#FFE5D2] text-[#D46320] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Everything in Starter included</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#FFE5D2] text-[#D46320] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Unlimited Custom Role Permissions</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#FFE5D2] text-[#D46320] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Extended File Storage up to 100GB</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#FFE5D2] text-[#D46320] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Priority Firestore &amp; Edge Latency</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-[#FFE5D2] text-[#D46320] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </div>
                  <span>Custom Capability Link Branding</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/register" className="w-full block">
                <button
                  type="button"
                  className="w-full py-3.5 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[#EA543D] to-[#E95E48] hover:brightness-105 active:scale-98 transition-all shadow-[0_4px_14px_rgba(233,94,72,0.35)] cursor-pointer"
                >
                  Upgrade to Pro
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          ABOUT SECTION
          ======================================================== */}
      <section id="about" className="relative z-10 py-16 sm:py-20 max-w-7xl mx-auto px-6 sm:px-10 select-none">
        <div className="rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FFF9F3] to-[#FFF1E8] border-2 border-[#EFE5D8] p-8 sm:p-14 shadow-[0_12px_32px_rgba(45,28,27,0.04)] text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-bold tracking-widest text-[#9C8B88] uppercase">
            <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
            <span>OUR MISSION</span>
            <span className="w-8 h-[1.5px] bg-[#D8CCC8]" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#2D1C1B] tracking-tight max-w-2xl mx-auto">
            Built for thinkers, creators, and teams who move fast.
          </h2>

          <p className="text-sm sm:text-base text-[#736360] leading-relaxed max-w-2xl mx-auto">
            SyncShelf reimagines your clipboard as a shared, physical tabletop. Whether you&apos;re saving snippets of code, gathering visual inspirations, tracking client deliverables, or coordinating deadlines, SyncShelf keeps everything tactile, organized, and effortlessly in sync.
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#9C8B88]">
            <span>Crafted with</span>
            <Heart className="h-3.5 w-3.5 text-[#E95E48] fill-[#E95E48]" />
            <span>for frictionless collaboration</span>
          </div>
        </div>
      </section>
    </>
  );
}
