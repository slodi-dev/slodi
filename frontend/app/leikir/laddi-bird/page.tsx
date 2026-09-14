"use client";

import dynamic from "next/dynamic";

// Canvas, requestAnimationFrame, Audio and localStorage are all client-only.
// Skipping SSR avoids hydration mismatches and keeps the game engine out of
// the server bundle.
const LaddiBirdPage = dynamic(() => import("@/components/leikir/laddi-bird/LaddiBirdPage"), {
  ssr: false,
});

export default function Page() {
  return <LaddiBirdPage />;
}
