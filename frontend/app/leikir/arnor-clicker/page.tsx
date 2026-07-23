"use client";

import dynamic from "next/dynamic";

// Idle clicker using localStorage, cookies-free client state, and click
// handlers — all client-only. Skipping SSR avoids hydration mismatches and
// keeps the game logic out of the server bundle.
const ArnorClickerGame = dynamic(
  () => import("@/components/leikir/arnor-clicker/ArnorClickerGame"),
  { ssr: false }
);

export default function Page() {
  return <ArnorClickerGame />;
}
