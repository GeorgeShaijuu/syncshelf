"use client";

import * as React from "react";
import type { AnimationItem } from "lottie-web";
import { cn } from "@/lib/utils";

// In-memory cache for loaded animation JSON data to prevent duplicate fetches
const jsonCache = new Map<string, Record<string, unknown>>();

// Singleton reference to dynamically imported lottie-web player
let lottieModulePromise: Promise<typeof import("lottie-web")["default"]> | null = null;

function loadLottieModule() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!lottieModulePromise) {
    lottieModulePromise = import("lottie-web").then((mod) => mod.default || mod);
  }
  return lottieModulePromise;
}

interface LottieSkeletonProps {
  animationPath: string;
  className?: string;
  aspectRatio?: string;
  fallback?: React.ReactNode;
}

/**
 * Performant, shared Lottie.js skeleton player.
 * - Dynamically loads lottie-web once (no duplicate bundle copies).
 * - Caches animation JSON in-memory.
 * - Respects prefers-reduced-motion.
 * - Cleans up instances on unmount to avoid memory leaks.
 */
export function LottieSkeleton({
  animationPath,
  className,
  fallback,
}: LottieSkeletonProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const animRef = React.useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let isCancelled = false;

    async function initAnimation() {
      if (!containerRef.current) return;

      // Check prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      try {
        const lottie = await loadLottieModule();
        if (!lottie || isCancelled || !containerRef.current) return;

        let animData = jsonCache.get(animationPath);
        if (!animData) {
          const res = await fetch(animationPath);
          if (!res.ok) throw new Error(`Failed to load ${animationPath}`);
          animData = (await res.json()) as Record<string, unknown>;
          if (animData) {
            jsonCache.set(animationPath, animData);
          }
        }

        if (isCancelled || !containerRef.current || !animData) return;

        // Destroy previous animation if any
        if (animRef.current) {
          animRef.current.destroy();
        }

        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: !prefersReducedMotion,
          autoplay: !prefersReducedMotion,
          animationData: animData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
            progressiveLoad: true,
            hideOnTransparent: true,
          },
        });

        animRef.current = anim;
        if (prefersReducedMotion) {
          anim.goToAndStop(0, true);
        }
        setLoaded(true);
      } catch (err) {
        console.warn("[LottieSkeleton] Failed to initialize animation:", err);
      }
    }

    initAnimation();

    return () => {
      isCancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [animationPath]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full relative overflow-hidden pointer-events-none select-none", className)}
    >
      {!loaded && fallback}
    </div>
  );
}

/**
 * 1. Board Lane Skeleton:
 * Full lane placeholder with header icon, title bar, and stacked card slots.
 */
export function BoardLaneSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col w-[280px] sm:w-[305px] md:w-[325px] lg:w-[340px] xl:w-[355px] shrink-0 h-full rounded-3xl bg-[#F2ECE3]/80 border border-[#E7E0D2] p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.025),0_1px_2px_rgba(255,255,255,0.7)] select-none",
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-1.5 py-1.5 mb-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[#E5DECFA0] animate-pulse" />
          <div className="space-y-1">
            <div className="h-3 w-16 bg-[#E0D7C6A0] rounded-md animate-pulse" />
            <div className="h-2 w-10 bg-[#E0D7C660] rounded-sm animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-6 rounded-lg bg-[#E0D7C660] animate-pulse" />
      </div>

      {/* Lottie Animation Cards Container */}
      <div className="flex-1 overflow-hidden space-y-3 pr-0.5 pb-2">
        <ClipboardCardSkeleton />
        <ClipboardCardSkeleton />
        <ClipboardCardSkeleton />
      </div>
    </div>
  );
}

/**
 * 2. Clipboard Card Skeleton:
 * Animated Lottie card skeleton with warm clay styling.
 */
export function ClipboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full h-[145px] rounded-2xl bg-[#FFFEFA]/90 border border-[#EDE5D9] p-3.5 shadow-sm overflow-hidden relative flex flex-col justify-between",
        className
      )}
    >
      <LottieSkeleton
        animationPath="/animations/skeletons/clay-card-skeleton.json"
        className="absolute inset-0 w-full h-full"
        fallback={
          <div className="h-full w-full flex flex-col justify-between p-1 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 rounded-md bg-[#E8E1D5]" />
              <div className="h-4 w-6 rounded bg-[#E8E1D5]" />
            </div>
            <div className="space-y-1.5 py-2">
              <div className="h-3 w-3/4 rounded bg-[#E8E1D5]" />
              <div className="h-3 w-1/2 rounded bg-[#E8E1D5]/70" />
            </div>
            <div className="h-2.5 w-1/3 rounded bg-[#E8E1D5]/60" />
          </div>
        }
      />
    </div>
  );
}

/**
 * 3. Calendar Date Cell Skeleton:
 * Skeleton for individual date cells in the calendar grid.
 */
export function CalendarCellSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-h-[90px] sm:min-h-[110px] rounded-2xl bg-[#FFFEFB]/80 border border-[#EDE5D9] p-2 relative overflow-hidden",
        className
      )}
    >
      <LottieSkeleton
        animationPath="/animations/skeletons/clay-cell-skeleton.json"
        className="absolute inset-0 w-full h-full"
        fallback={
          <div className="h-full w-full p-1 animate-pulse flex flex-col justify-between">
            <div className="h-5 w-5 rounded-full bg-[#E8E1D5]" />
            <div className="h-3 w-12 rounded bg-[#E8E1D5]/60 mt-auto" />
          </div>
        }
      />
    </div>
  );
}

/**
 * 4. Calendar Selected-Date Panel Skeleton:
 * Shows animated skeleton while items for a selected calendar date are loading.
 */
export function CalendarSelectedPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-[#FFFEFB] border border-[#EDE5D9] p-4 shadow-sm space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#F5EFE5] pb-2">
        <div className="h-4 w-28 rounded bg-[#E8E1D5] animate-pulse" />
        <div className="h-4 w-12 rounded bg-[#E8E1D5]/70 animate-pulse" />
      </div>
      <div className="space-y-2.5 pt-1">
        <ClipboardCardSkeleton className="h-[110px]" />
        <ClipboardCardSkeleton className="h-[110px]" />
      </div>
    </div>
  );
}

/**
 * 5. Recent Space Card Skeleton:
 * Used on the /spaces collection page while recent shared spaces are loading.
 */
export function RecentSpaceCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-4 bg-[#FFFEFA] border border-[#EDE5D9] rounded-2xl flex flex-col justify-between gap-3 h-[180px] relative overflow-hidden shadow-xs",
        className
      )}
    >
      <LottieSkeleton
        animationPath="/animations/skeletons/clay-card-skeleton.json"
        className="absolute inset-0 w-full h-full"
        fallback={
          <div className="h-full w-full p-1 animate-pulse flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-[#E8E1D5]" />
              <div className="h-3 w-24 rounded bg-[#E8E1D5]" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-[#E8E1D5]" />
              <div className="h-3 w-1/2 rounded bg-[#E8E1D5]/70" />
            </div>
            <div className="h-7 w-full rounded-xl bg-[#E8E1D5]/50" />
          </div>
        }
      />
    </div>
  );
}
