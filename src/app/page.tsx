import { fetchBoards } from "@/app/api/boards";
import { imgixEagerThumb } from "@/lib/imgix";
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

  // Preload ONLY the top LCP candidates (first two wall images). Board
  // thumbs are real <img> tags in the SSR HTML already, and preloading a
  // long list makes every preload compete with render-critical JS/CSS on
  // slow connections — worse than preloading nothing.
  const preloadImages = (initialAssets?.data.clips.slice(0, 2) ?? []).map((c) =>
    imgixEagerThumb(c.assets.image)
  );

  return (
    <main className="min-h-screen">
      {preloadImages.map((href) => (
        // React hoists these to <head>; lowercase attribute because React
        // 18.2 predates the camelCase fetchPriority prop.
        <link key={href} rel="preload" as="image" href={href} {...{ fetchpriority: "high" }} />
      ))}
      <Gallery initialBoards={initialBoards} initialAssets={initialAssets} />
    </main>
  );
}
