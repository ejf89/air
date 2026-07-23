"use client";

import * as React from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useBoardAssets, type AssetQueryOptions } from "@/hooks/useBoardAssets";
import { useGalleryStore } from "@/lib/store";
import { computeJustifiedRows } from "@/lib/justifiedLayout";
import { tileRegistry } from "@/lib/tileRegistry";
import { AssetTile } from "./AssetTile";

const TARGET_ROW_HEIGHT = 300;
const GAP = 20;

export interface AssetGridProps {
  boardId: string;
  /** Server-driven search/sort. When set, the server's order is rendered
   *  directly and manual reordering is disabled (matches Air: manual
   *  arrangement only exists in "Custom" sort). */
  queryOptions?: AssetQueryOptions;
  emptyMessage?: string;
  /** Reports the server's total asset count for the section header. */
  onTotalChange?: (total: number) => void;
}

/**
 * Justified "wall" of assets for one board. Rows are packed from the real
 * width/height in the API payload (no image decode needed for layout), and
 * only visible rows are mounted via window-scroll virtualization — the whole
 * page scrolls as one surface, like the real Air gallery.
 */
export function AssetGrid({
  boardId,
  queryOptions,
  emptyMessage,
  onTotalChange,
}: AssetGridProps): JSX.Element {
  const serverMode = Boolean(queryOptions?.serverMode);
  const { clips, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, total } =
    useBoardAssets(boardId, true, queryOptions);

  React.useEffect(() => {
    if (!isLoading) onTotalChange?.(total);
  }, [total, isLoading, onTotalChange]);

  const localOrder = useGalleryStore((s) => s.orderByBoard[boardId]) ?? EMPTY;
  const assetById = useGalleryStore((s) => s.assetById);

  const items = React.useMemo(() => {
    if (serverMode) return clips;
    return localOrder
      .map((id) => assetById[id])
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [serverMode, clips, localOrder, assetById]);

  const order = React.useMemo(
    () => (serverMode ? items.map((c) => c.id) : localOrder),
    [serverMode, items, localOrder]
  );

  // Stable getter so tiles can read the current order at event time
  // without receiving the churning array as a prop (see AssetTileProps).
  const orderRef = React.useRef(order);
  orderRef.current = order;
  const getOrder = React.useCallback(() => orderRef.current, []);

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
    overscan: 3,
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

  // Tiles register into the shared registry; the page-level rubber band
  // in Gallery.tsx intersects against it.
  const registerTileRef = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) tileRegistry.set(id, el);
    else tileRegistry.delete(id);
  }, []);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

  // FLIP: when the packed layout changes (reorder, move-out, resize), each
  // surviving tile animates from its previous position instead of jumping.
  // Positions are stored in page coordinates, so scrolling (which doesn't
  // move tiles on the page) never produces bogus deltas — and the effect
  // only runs when `rows` actually changes, never per scroll frame.
  const prevPositions = React.useRef(new Map<string, { x: number; y: number }>());
  React.useLayoutEffect(() => {
    const moved: Array<[HTMLElement, number, number]> = [];
    const seen = new Set<string>();
    tileRegistry.forEach((el, id) => {
      if (!el.isConnected) return;
      seen.add(id);
      const r = el.getBoundingClientRect();
      const x = r.left + window.scrollX;
      const y = r.top + window.scrollY;
      const prev = prevPositions.current.get(id);
      if (prev && (Math.abs(prev.x - x) > 1 || Math.abs(prev.y - y) > 1)) {
        moved.push([el, prev.x - x, prev.y - y]);
      }
      prevPositions.current.set(id, { x, y });
    });
    prevPositions.current.forEach((_, id) => {
      if (!seen.has(id)) prevPositions.current.delete(id);
    });
    if (!moved.length) return;
    for (const [el, dx, dy] of moved) {
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    requestAnimationFrame(() => {
      for (const [el] of moved) {
        el.style.transition = "transform 240ms cubic-bezier(0.2, 0, 0, 1)";
        el.style.transform = "";
      }
    });
  }, [rows]);

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
      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          {emptyMessage ?? "No assets in this board — drag some in."}
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
                      getOrder={getOrder}
                      width={tile.displayWidth}
                      height={tile.displayHeight}
                      reorderable={!serverMode}
                      eager={virtualRow.index < 1}
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
