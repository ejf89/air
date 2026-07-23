import { useGalleryStore } from "@/lib/store";

/**
 * Trigger real browser downloads for one or more assets. Staggered slightly
 * so the browser doesn't drop all but the first programmatic click.
 */
export function downloadAssets(assetIds: string[]) {
  const { assetById } = useGalleryStore.getState();
  assetIds.forEach((id, i) => {
    const asset = assetById[id];
    if (!asset) return;
    const url = asset.assets.original ?? asset.assets.image;
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.importedName ?? asset.title ?? "asset";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 250);
  });
}
