"use client";

import * as React from "react";

export function OrganicBackgroundArtwork() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Upper-Right Corner Abstract Wave Artwork */}
      <div className="absolute -top-12 -right-12 w-[340px] h-[260px] sm:w-[420px] sm:h-[300px]">
        <svg
          viewBox="0 0 420 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Layer 1: Warm Golden Yellow */}
          <path
            d="M80 0 C160 80, 220 30, 280 120 C330 180, 390 140, 420 200 L420 0 Z"
            fill="#FFC84B"
            opacity="0.9"
          />
          {/* Layer 2: Vibrant Orange */}
          <path
            d="M160 0 C220 60, 280 40, 330 100 C370 140, 400 130, 420 160 L420 0 Z"
            fill="#F28A32"
          />
          {/* Layer 3: Coral Deep Wave */}
          <path
            d="M260 0 C300 40, 350 30, 380 70 C400 100, 410 110, 420 120 L420 0 Z"
            fill="#E84B35"
          />
        </svg>
      </div>

      {/* Lower-Left Corner Abstract Wave Artwork */}
      <div className="absolute -bottom-16 -left-12 w-[360px] h-[260px] sm:w-[440px] sm:h-[300px]">
        <svg
          viewBox="0 0 440 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Layer 1: Golden Yellow Soft Wave */}
          <path
            d="M0 120 C80 140, 140 220, 220 190 C280 160, 330 250, 420 220 L440 300 L0 300 Z"
            fill="#FFC84B"
            opacity="0.9"
          />
          {/* Layer 2: Warm Peach Wave */}
          <path
            d="M0 170 C60 190, 110 240, 180 230 C240 220, 280 270, 350 260 L440 300 L0 300 Z"
            fill="#FFE0C9"
            opacity="0.8"
          />
          {/* Layer 3: Orange Accent Wave */}
          <path
            d="M0 220 C50 230, 90 270, 150 260 C200 250, 230 280, 280 280 L440 300 L0 300 Z"
            fill="#F28A32"
            opacity="0.95"
          />
        </svg>
      </div>
    </div>
  );
}
