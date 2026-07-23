import { fetchBoards } from "@/app/api/boards";
import { fetchAssets } from "@/app/api/clips";
import { Gallery } from "@/components/gallery/Gallery";

// ISR: the first page of boards + assets is fetched server-side and baked
// into the HTML, so the client paints real content right after hydration
// instead of paying an extra API round-trip before the LCP image can even
// be discovered. React Query takes over from this initial data for
// pagination, search, and sort.
export const revalidate = 300;

export default async function Home() {
  const [initialBoards, initialAssets] = await Promise.all([
    fetchBoards().catch(() => undefined),
    fetchAssets({ cursor: null }).catch(() => undefined),
  ]);

  return (
    <main className="min-h-screen">
      <Gallery initialBoards={initialBoards} initialAssets={initialAssets} />
    </main>
  );
}
