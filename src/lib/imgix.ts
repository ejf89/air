/**
 * air-prod.imgix.net serves originals directly; without resize params a
 * justified grid of 500+ tiles would pull full multi-MB originals. We ask
 * imgix for roughly the box we're going to render so the network/decode
 * cost matches what's on screen.
 *
 * dpr is HARDCODED to 2 (it was already capped there): reading
 * window.devicePixelRatio makes server- and client-rendered srcs differ,
 * which double-downloads every SSR'd thumbnail after hydration.
 */
const DPR = 2;

/**
 * Viewport-independent variant for above-the-fold tiles: the URL doesn't
 * depend on client-measured layout, so the server can emit byte-identical
 * <link rel="preload"> tags — the LCP image request starts at HTML parse
 * time instead of after hydration measures the grid. No h/fit=crop: the
 * image keeps its own aspect ratio and object-cover renders identically.
 */
export function imgixEagerThumb(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("w", "640");
    u.searchParams.set("auto", "format,compress");
    u.searchParams.set("q", "45");
    return u.toString();
  } catch {
    return url;
  }
}

export function imgixThumb(url: string, width: number, height: number): string {
  try {
    const u = new URL(url);
    // Bucket sizes to 100px steps: when the justified layout reflows (row
    // repacking after a move/resize), tiles keep the same src for small size
    // changes and reuse the browser cache instead of flashing blank while a
    // marginally-different crop refetches.
    const bucket = (v: number) => Math.ceil((v * DPR) / 100) * 100;
    u.searchParams.set("w", String(bucket(width)));
    u.searchParams.set("h", String(bucket(height)));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("auto", "format,compress");
    u.searchParams.set("q", "45");
    return u.toString();
  } catch {
    return url;
  }
}
