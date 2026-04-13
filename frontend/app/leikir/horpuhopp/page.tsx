"use client";

import dynamic from "next/dynamic";

// The game requires canvas, requestAnimationFrame, and sessionStorage — all
// client-only APIs. Skipping SSR avoids hydration mismatches and keeps the
// server bundle free of game logic.
const HorpuhoppPage = dynamic(() => import("@/components/leikir/horpuhopp/HorpuhoppPage"), {
  ssr: false,
});

export default function Page() {
  return <HorpuhoppPage />;
}
