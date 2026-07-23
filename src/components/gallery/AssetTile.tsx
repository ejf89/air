"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useGalleryStore } from "@/lib/store";
import { imgixEagerThumb, imgixThumb } from "@/lib/imgix";
import type { Clip } from "@/app/api/clips";
import { AssetContextMenu, AssetEllipsisButton } from "./AssetMenu";

export interface AssetTileProps {
  asset: Clip;
  /** Stable getter for the board's current ordered id list — read at
   *  event time (shift+click range) so the array's identity churn on every
   *  fetch/reorder never busts React.memo for mounted tiles. */
  getOrder: () => string[];
  width: number; // computed display width in px (from justified layout, upstream)
  height: number; // computed display height in px
  /** False in server-driven views (search / explicit sort), where manual
   *  reordering doesn't apply — the tile stops being a drop target. */
  reorderable?: boolean;
  /** True for above-the-fold rows: loads the image eagerly at high priority
   *  instead of lazily, so the LCP image isn't queued behind lazy-loading. */
  eager?: boolean;
}

// ---- small module-level pieces (never recreated per render) ---------------

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 2.5L11.5 7L4 11.5V2.5Z" fill="white" />
    </svg>
  );
}

/** The one live <video> in the app (single-slot, see hoveredAssetId).
 *  Hidden until the first frame actually plays, then faded in over the
 *  still-mounted poster — no black flash while the preview buffers. */
function HoverPreview({ src }: { src: string }): JSX.Element {
  const [ready, setReady] = React.useState(false);
  return (
    <video
      src={src}
      muted
      autoPlay
      loop
      playsInline
      onPlaying={() => setReady(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

function AssetTileImpl(props: AssetTileProps): JSX.Element {
  const { asset, getOrder, width, height, reorderable = true, eager = false } = props;

  // Derived-boolean selectors (not the raw `selectedIds` array reference) so
  // zustand only re-renders THIS tile when its own membership/hover state
  // actually flips, not on every selection change anywhere on the page —
  // with 500+ tiles mounted across sections, subscribing to the raw array
  // would re-render all of them on every click/rubber-band tick.
  const isSelected = useGalleryStore((s) => s.selectedSet.has(asset.id));
  const isHoveredForVideo = useGalleryStore((s) => s.hoveredAssetId === asset.id);
  const setHovered = useGalleryStore((s) => s.setHovered);
  const select = useGalleryStore((s) => s.select);
  const toggleSelect = useGalleryStore((s) => s.toggleSelect);
  const selectRange = useGalleryStore((s) => s.selectRange);

  const isHoveredVideo =
    asset.type === "video" && isHoveredForVideo && !!asset.assets.previewVideo;

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: asset.id,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `asset-drop-${asset.id}`,
    disabled: !reorderable,
  });

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  const hoverTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    if (asset.type === "video" && asset.assets.previewVideo) {
      hoverTimeout.current = setTimeout(() => setHovered(asset.id), 220);
    }
  }, [asset.type, asset.assets.previewVideo, asset.id, setHovered]);

  const handleMouseLeave = React.useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    if (useGalleryStore.getState().hoveredAssetId === asset.id) {
      setHovered(null);
    }
  }, [asset.id, setHovered]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        selectRange(asset.id, getOrder());
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelect(asset.id);
      } else {
        select(asset.id);
      }
    },
    [asset.id, getOrder, selectRange, toggleSelect, select]
  );

  const style: React.CSSProperties = {
    width,
    height,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <AssetContextMenu assetId={asset.id}>
      <div
        ref={setRefs}
        // Air's interaction model: rubber-band select starts anywhere —
        // including on tiles — and only an already-SELECTED tile drags
        // assets. data-draggable="true" blocks the selection library, so it
        // must reflect selection state; the dnd sensor applies the same rule
        // from the other side (see GalleryPointerSensor).
        data-draggable={isSelected ? "true" : "false"}
        data-asset-id={asset.id}
        className={`group relative overflow-hidden rounded-lg bg-neutral-100 select-none transition-shadow ${
          isSelected
            ? "cursor-grab ring-2 ring-blue-600 ring-offset-2 active:cursor-grabbing"
            : "ring-1 ring-inset ring-black/5 hover:shadow-md hover:ring-black/10"
        }`}
        style={style}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...attributes}
        {...listeners}
      >
        {isOver ? (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-[3px] bg-blue-500" />
        ) : null}

        {/* Poster stays mounted under the video so hover-preview fades in
            from the poster instead of flashing a black loading frame. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- imgix already serves right-sized, format-negotiated thumbs; next/image's per-tile observers fight the virtualizer at 500+ tiles */}
        <img
          src={eager ? imgixEagerThumb(asset.assets.image) : imgixThumb(asset.assets.image, width, height)}
          alt={asset.title ?? asset.importedName ?? ""}
          width={Math.round(width)}
          height={Math.round(height)}
          className="w-full h-full object-cover"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          // React 18.2 predates the camelCase fetchPriority prop — render
          // the DOM attribute directly so it actually reaches the element.
          {...(eager ? { fetchpriority: "high" } : {})}
        />
        {isHoveredVideo ? <HoverPreview src={asset.assets.previewVideo!} /> : null}

        {asset.type === "video" && !isHoveredVideo ? (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40">
                <PlayIcon />
              </div>
            </div>
            {asset.duration ? (
              <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded px-1.5 py-0.5 text-[11px] leading-none text-white bg-black/60">
                {formatDuration(asset.duration)}
              </div>
            ) : null}
          </>
        ) : null}

        {/* Hover info overlay — pure CSS (group-hover), zero per-frame JS cost */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {asset.title ?? asset.importedName ?? "Untitled"}
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-white/80">
            {asset.ext?.toUpperCase()}
            {asset.size ? ` · ${formatSize(asset.size)}` : ""}
            {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}
          </p>
        </div>

        <div className="absolute top-1.5 left-1.5 z-10">
          {isSelected ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white opacity-100">
              <CheckIcon />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-white/90 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>

        <AssetEllipsisButton assetId={asset.id} />
      </div>
    </AssetContextMenu>
  );
}

export const AssetTile = React.memo(AssetTileImpl);
AssetTile.displayName = "AssetTile";
