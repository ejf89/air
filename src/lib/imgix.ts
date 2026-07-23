/**
 * air-prod.imgix.net serves originals directly; without resize params a
 * justified grid of 500+ tiles would pull full multi-MB originals. We ask
 * imgix for exactly the box we're going to render (times DPR, capped) so
 * the network/decode cost matches what's on screen.
 */
export function imgixThumb(url: string, width: number, height: number): string {
  try {
    const u = new URL(url);
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    // Bucket sizes to 100px steps: when the justified layout reflows (row
    // repacking after a move/resize), tiles keep the same src for small size
    // changes and reuse the browser cache instead of flashing blank while a
    // marginally-different crop refetches.
    const bucket = (v: number) => Math.ceil((v * dpr) / 100) * 100;
    u.searchParams.set("w", String(bucket(width)));
    u.searchParams.set("h", String(bucket(height)));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("auto", "format,compress");
    u.searchParams.set("q", "60");
    return u.toString();
  } catch {
    return url;
  }
}
