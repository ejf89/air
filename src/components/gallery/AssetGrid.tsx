"use client";

import * as React from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useSelectionContainer, boxesIntersect } from "react-drag-to-select";
import { useBoardAssets } from "@/hooks/useBoardAssets";
import { useGalleryStore } from "@/lib/store";
import { computeJustifiedRows } from "@/lib/justifiedLayout";
import { AssetTile } from "./AssetTile";

const TARGET_ROW_HEIGHT = 200;
const GAP = 8;

export interface AssetGridProps {
  boardId: string;
}

/**
 * Justified "wall" of assets for one board. Rows are packed from the real
 * width/height in the API payload (no image decode needed for layout), and
 * only visible rows are mounted via window-scroll virtualization — the whole
 * page scrolls as one surface, like the real Air gallery.
 */
export function AssetGrid({ boardId }: AssetGridProps): JSX.Element {
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, total } =
    useBoardAssets(boardId, true);

  const order = useGalleryStore((s) => s.orderByBoard[boardId]) ?? EMPTY;
  const assetById = useGalleryStore((s) => s.assetById);

  const items = React.useMemo(
    () => order.map((id) => assetById[id]).filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [order, assetById]
  );

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [scrollMargin, setScrollMargin] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setContainerWidth(el.clientWidth);
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Content above us (boards section expanding/collapsing) shifts our page
    // offset without resizing us — watch the body too.
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const rows = React.useMemo(
    () => computeJustifiedRows(items, containerWidth, TARGET_ROW_HEIGHT, GAP),
    [items, containerWidth]
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.height ?? TARGET_ROW_HEIGHT) + GAP,
    overscan: 5,
    scrollMargin,
  });

  // Row heights depend on container width + data, both of which change the
  // `rows` array identity — flush the virtualizer's measurement cache then.
  const rowsRef = React.useRef(rows);
  React.useEffect(() => {
    if (rowsRef.current !== rows) {
      rowsRef.current = rows;
      rowVirtualizer.measure();
    }
  }, [rows, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();

  React.useEffect(() => {
    const last = virtualRows[virtualRows.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 4 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualRows, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ---- rubber-band multi-select ------------------------------------------
  const tileRefs = React.useRef(new Map<string, HTMLElement>());
  const registerTileRef = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) tileRefs.current.set(id, el);
    else tileRefs.current.delete(id);
  }, []);
  const setSelection = useGalleryStore((s) => s.setSelection);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

  const { DragSelection } = useSelectionContainer({
    eventsElement: typeof window === "undefined" ? undefined : containerRef.current,
    onSelectionChange: (box) => {
      // `box` and getBoundingClientRect are both viewport-relative, and both
      // are read live mid-drag, so they can be intersected directly. Only
      // mounted (visible + overscan) tiles can match — acceptable for a
      // rubber band, which is inherently a visible-area gesture.
      const matched: string[] = [];
      tileRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (boxesIntersect(box, { left: r.left, top: r.top, width: r.width, height: r.height })) {
          matched.push(id);
        }
      });
      setSelection(matched);
    },
    selectionProps: {
      style: {
        border: "1.5px solid rgb(59 130 246)",
        borderRadius: 4,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        zIndex: 30,
      },
    },
  });

  const isEmpty = !isLoading && total === 0 && items.length === 0;
  const showSkeleton = isLoading && !rows.length;

  // NOTE: the measured container must always be mounted (skeleton/empty
  // states render inside it) — the width/offset measurement effect only runs
  // once, so an early return here would leave containerWidth at 0 forever.
  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(e) => {
        if (e.target === e.currentTarget) clearSelection();
      }}
    >
      <DragSelection />
      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          No assets in this board — drag some in.
        </div>
      ) : null}
      {showSkeleton ? (
        <div className="grid animate-pulse grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-neutral-100" />
          ))}
        </div>
      ) : null}
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <div
              key={row.key}
              className="absolute left-0 top-0 flex w-full"
              style={{
                height: row.height,
                gap: GAP,
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              {row.tiles.map((tile) => {
                const asset = assetById[tile.id];
                if (!asset) return null;
                return (
                  <div
                    key={tile.id}
                    ref={(el) => registerTileRef(tile.id, el)}
                    style={{ width: tile.displayWidth, height: tile.displayHeight }}
                  >
                    <AssetTile
                      asset={asset}
                      boardId={boardId}
                      order={order}
                      width={tile.displayWidth}
                      height={tile.displayHeight}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {isFetchingNextPage ? (
        <div className="py-4 text-center text-xs text-neutral-400">Loading more…</div>
      ) : null}
    </div>
  );
}

const EMPTY: string[] = [];
