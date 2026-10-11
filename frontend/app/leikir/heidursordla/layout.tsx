import { notFound } from "next/navigation";
import { HEIDURSORDLA_ENABLED } from "@/lib/feature-flags";

/**
 * Gates both Heiðursorðla routes (this page and [puzzleId]). Hidden behind
 * HEIDURSORDLA_ENABLED (user decision 2026-10-11): the page code stays, but
 * while the flag is off every visit is a 404.
 */
export default function HeidursordlaLayout({ children }: { children: React.ReactNode }) {
  if (!HEIDURSORDLA_ENABLED) notFound();
  return children;
}
