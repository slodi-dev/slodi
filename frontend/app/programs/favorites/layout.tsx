import { notFound } from "next/navigation";
import { FAVOURITES_ENABLED } from "@/lib/feature-flags";

/**
 * Gates the favourites page. Hidden behind FAVOURITES_ENABLED (UX-01): the page
 * code stays, but while the flag is off every visit is a 404.
 */
export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  if (!FAVOURITES_ENABLED) notFound();
  return children;
}
