"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AppLoadingScreenProps {
  heading?: string;
  subtitle?: string;
  className?: string;
  isFadingOut?: boolean;
}

/**
 * Full-screen initial application loading screen.
 * - Features the official SyncShelf cat mascot animation with 100% alpha transparency.
 * - Warm ivory clay background (#FAF7F0) with playful claymorphic aesthetics.
 * - Mobile & Safari Solution:
 *   Mobile browsers (especially iOS WebKit / Safari) do not support alpha channels in VP9 WebM
 *   (rendering transparent pixels as solid black). We use responsive CSS + user-agent detection
 *   to serve the high-fidelity animated WebP (/animations/loading_main.webp) on mobile & Safari,
 *   guaranteeing true alpha transparency with zero black borders or hardware overlay issues.
 * - Respects prefers-reduced-motion by rendering the static transparent poster.
 * - Non-blocking: application readiness is completely decoupled from video playback.
 */
export function AppLoadingScreen({
  heading = "Getting your shelf ready...",
  subtitle = "Organising your clips, just a moment.",
  className,
  isFadingOut = false,
}: AppLoadingScreenProps) {
  const [videoError, setVideoError] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [useImageAnimation, setUseImageAnimation] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Check prefers-reduced-motion
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);

      // 2. Mobile & Safari Alpha Transparency Support Detection:
      // iOS WebKit and macOS Safari do not support WebM alpha channels (rendering black background).
      // Many mobile Android MediaCodec decoders also force opaque black surfaces on <video>.
      // We route mobile and Safari users to the native transparent animated WebP.
      const ua = navigator.userAgent || "";
      const isMobileDevice =
        /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
        window.innerWidth < 768 ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
      const isSafari =
        /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/.test(ua);

      if (isMobileDevice || isSafari || isIOS) {
        setUseImageAnimation(true);
      }

      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center bg-[#FAF7F0] text-[#24211F] transition-opacity duration-300 select-none overflow-hidden",
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100",
        className
      )}
    >
      {/* Background Soft Clay Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#FFE8D6]/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FFF3D6]/50 blur-3xl pointer-events-none" />

      {/* Main Mascot & Loading Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        {/* Playful Mascot Wrapper */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Subtle Clay Shadow Pod underneath */}
          <div className="absolute -bottom-2 w-44 h-8 rounded-full bg-[#E8DECDB0]/60 blur-md -z-10" />

          {/* Cat Mascot Animation / Poster */}
          {prefersReducedMotion ? (
            /* Reduced Motion: Static Transparent Poster */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/animations/loading_main_poster.png"
              alt="SyncShelf Mascot"
              className="w-48 h-52 sm:w-56 sm:h-60 object-contain select-none bg-transparent"
              style={{ backgroundColor: "transparent" }}
            />
          ) : (
            <>
              {/*
                Mobile & Safari: Animated WebP with 100% native alpha transparency and background disposal.
                Uses responsive CSS (`block md:hidden`) so on any mobile viewport width,
                it renders immediately even before JavaScript hydration with NO black box.
                Also rendered on desktop if WebM encounters an error or browser is Safari.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/animations/loading_main.webp"
                alt="SyncShelf Mascot"
                className={cn(
                  "w-48 h-52 sm:w-56 sm:h-60 object-contain select-none bg-transparent",
                  useImageAnimation || videoError ? "block" : "block md:hidden"
                )}
                style={{ backgroundColor: "transparent" }}
              />

              {/*
                Desktop Chrome/Firefox/Edge: Plays the original WebM video.
                Hidden on mobile via `hidden md:block`.
                If video fails or browser is Safari, this is unmounted in favor of the animated WebP.
              */}
              {!(useImageAnimation || videoError) && (
                <video
                  ref={videoRef}
                  src="/animations/loading_main.webm"
                  poster="/animations/loading_main_poster.png"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onError={() => setVideoError(true)}
                  className="hidden md:block w-48 h-52 sm:w-56 sm:h-60 object-contain select-none bg-transparent"
                  style={{ backgroundColor: "transparent" }}
                />
              )}
            </>
          )}
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-[#24211F] tracking-tight">
            {heading}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#7A7268] max-w-xs mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Playful Clay Loading Indicator Bar */}
        <div className="mt-7 w-40 sm:w-48 h-2.5 rounded-full bg-[#EDE5D8] overflow-hidden p-0.5 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] relative">
          <div className="h-full rounded-full bg-gradient-to-r from-[#F58B35] via-[#FFAE6B] to-[#F58B35] animate-shimmer-bar w-[45%]" />
        </div>
      </div>
    </div>
  );
}
