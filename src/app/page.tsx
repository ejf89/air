import { fetchBoards } from "@/app/api/boards";
import { imgixEagerThumb, imgixThumb } from "@/lib/imgix";
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

  // Preload the first wall images + board thumbs: these exact URLs are what
  // the eager tiles render, so the LCP image request starts at HTML parse
  // time instead of after hydration measures the layout.
  const preloadImages = [
    ...(initialBoards?.data.slice(0, 4).map((b) => b.thumbnails?.[0]).filter(Boolean) ?? []).map(
      (u) => imgixThumb(u as string, 400, 250)
    ),
    ...(initialAssets?.data.clips.slice(0, 6) ?? []).map((c) => imgixEagerThumb(c.assets.image)),
  ];

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
