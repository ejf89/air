import { useGalleryStore } from "@/lib/store";

/**
 * Download assets for real. The `download` attribute is ignored on
 * cross-origin URLs (the browser would just navigate to the image), so we
 * fetch each file as a blob and save the object URL instead. Falls back to
 * opening in a new tab if the fetch is blocked.
 */
export async function downloadAssets(assetIds: string[]) {
  const { assetById } = useGalleryStore.getState();
  for (const id of assetIds) {
    const asset = assetById[id];
    if (!asset) continue;
    const url = asset.assets.original ?? asset.assets.image;
    const name = asset.importedName ?? asset.title ?? "asset";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = asset.ext ? `${name}.${asset.ext}` : name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}
