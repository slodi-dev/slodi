import { Suspense } from "react";
import TagManagement from "./components/TagManagement";

/** Suspense because the page keeps its search and page number in the URL (useSearchParams). */
export default function TagsPage() {
  return (
    <Suspense>
      <TagManagement />
    </Suspense>
  );
}
