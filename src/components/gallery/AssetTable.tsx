"use client";

import * as React from "react";
import Link from "next/link";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useBoardAssets, type AssetQueryOptions } from "@/hooks/useBoardAssets";
import { useGalleryStore } from "@/lib/store";
import { imgixThumb } from "@/lib/imgix";
import type { Board } from "@/app/api/boards";
import type { Clip, SortFieldName } from "@/app/api/clips";
import { formatSize } from "./AssetTile";
import { boardHref, type Crumb } from "./BoardMenu";
import type { SortMode } from "./Toolbar";

const ROW_H = 60;
// Name | Size | Date created | Date modified | Resolution | Extension | Type
const GRID_COLS =
  "grid grid-cols-[minmax(260px,1fr)_80px_120px_120px_120px_90px_80px] items-center gap-3";

const HEADERS: { label: string; field?: SortFieldName }[] = [
  { label: "Name", field: "name" },
  { label: "Size", field: "size" },
  { label: "Date created", field: "dateCreated" },
  { label: "Date modified", field: "dateModified" },
  { label: "Resolution" },
  { label: "Extension" },
  { label: "Type" },
];

function fmtDate(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export interface AssetTableProps {
  boardId: string;
  /** Child boards rendered as rows above the assets (omitted in search). */
  boards?: Board[];
  childPath: Crumb[];
  queryOptions?: AssetQueryOptions;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  emptyMessage?: string;
}

/**
 * Air-style table view: boards + assets as rows with metadata columns.
 * Same data pipeline as AssetGrid (react-query pages; local order in custom
 * mode, server order in search/sort mode), virtualized at a fixed row
 * height. Column headers drive the existing server sorts.
 */
export function AssetTable({
  boardId,
  boards = [],
  childPath,
  queryOptions,
  sort,
  onSortChange,
  emptyMessage,
}: AssetTableProps): JSX.Element {
  const serverMode = Boolean(queryOptions?.serverMode);
  const { clips, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, total } =
    useBoardAssets(boardId, true, queryOptions);

  const localOrder = useGalleryStore((s) => s.orderByBoard[boardId]) ?? EMPTY;
  const assetById = useGalleryStore((s) => s.assetById);
  // Whole-set subscription is fine here: only ~20 virtualized rows render.
  const selectedSet = useGalleryStore((s) => s.selectedSet);
  const select = useGalleryStore((s) => s.select);
  const toggleSelect = useGalleryStore((s) => s.toggleSelect);
  const selectRange = useGalleryStore((s) => s.selectRange);

  const items = React.useMemo(() => {
    if (serverMode) return clips;
    return localOrder
      .map((id) => assetById[id])
      .filter((a): a is Clip => Boolean(a));
  }, [serverMode, clips, localOrder, assetById]);

  const rowCount = boards.length + items.length;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_H,
    overscan: 10,
    scrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();

  React.useEffect(() => {
    const last = virtualRows[virtualRows.length - 1];
    if (!last) return;
    if (last.index >= rowCount - 10 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualRows, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleAssetClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey) {
      selectRange(id, items.map((c) => c.id));
    } else if (e.metaKey || e.ctrlKey) {
      toggleSelect(id);
    } else {
      select(id);
    }
  };

  const handleHeaderClick = (field?: SortFieldName) => {
    if (!field) return;
    if (sort.kind === "server" && sort.field.name === field) {
      onSortChange({
        kind: "server",
        field: { name: field, direction: sort.field.direction === "desc" ? "asc" : "desc" },
      });
    } else {
      onSortChange({ kind: "server", field: { name: field, direction: "desc" } });
    }
  };

  const isEmpty = !isLoading && total === 0 && items.length === 0 && boards.length === 0;

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <div role="table" aria-label="Assets" className="min-w-[880px]">
        <div role="row" className={`${GRID_COLS} border-b border-neutral-200 px-2 py-2`}>
          {HEADERS.map((h) => {
            const active = sort.kind === "server" && h.field === sort.field.name;
            return (
              <button
                key={h.label}
                role="columnheader"
                type="button"
                disabled={!h.field}
                data-draggable="true"
                onClick={() => handleHeaderClick(h.field)}
                className={`flex items-center gap-1 text-left text-[13px] font-medium ${
                  h.field
                    ? "text-neutral-600 hover:text-neutral-900"
                    : "cursor-default text-neutral-600"
                } ${active ? "text-neutral-900 underline underline-offset-4" : ""}`}
              >
                {h.label}
                {active ? (
                  <span aria-hidden>{sort.kind === "server" && sort.field.direction === "asc" ? "↑" : "↓"}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
            {emptyMessage ?? "No assets in this board."}
          </div>
        ) : null}

        {isLoading && !rowCount ? (
          <div className="animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-neutral-100 px-2 py-2.5">
                <div className="h-11 w-11 rounded-lg bg-neutral-100" />
                <div className="h-3 w-56 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualRows.map((vr) => {
            const board = vr.index < boards.length ? boards[vr.index] : null;
            const asset = board ? null : items[vr.index - boards.length];
            const rowStyle: React.CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: ROW_H,
              transform: `translateY(${vr.start - scrollMargin}px)`,
            };

            if (board) {
              const thumb = board.thumbnails?.[0];
              return (
                <Link
                  key={vr.key}
                  role="row"
                  href={boardHref(board.id, board.title, childPath)}
                  style={rowStyle}
                  className={`${GRID_COLS} border-b border-neutral-100 px-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-50`}
                >
                  <span role="cell" className="flex min-w-0 items-center gap-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imgix-optimized thumb
                      <img
                        src={imgixThumb(thumb, 44, 44)}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        decoding="async"
                        className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <span className="h-11 w-11 shrink-0 rounded-lg bg-neutral-100" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {board.title}
                      </span>
                      <span className="block text-xs text-neutral-500">Board</span>
                    </span>
                  </span>
                  <span role="cell">--</span>
                  <span role="cell">{fmtDate(board.createdAt)}</span>
                  <span role="cell">{fmtDate(board.updatedAt)}</span>
                  <span role="cell">--</span>
                  <span role="cell">--</span>
                  <span role="cell">--</span>
                </Link>
              );
            }

            if (!asset) return null;
            const isSelected = selectedSet.has(asset.id);
            return (
              <div
                key={vr.key}
                role="row"
                data-asset-id={asset.id}
                onClick={(e) => handleAssetClick(e, asset.id)}
                style={rowStyle}
                className={`${GRID_COLS} cursor-pointer select-none border-b border-neutral-100 px-2 text-sm text-neutral-500 transition-colors ${
                  isSelected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-neutral-50"
                }`}
              >
                <span role="cell" className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imgix-optimized thumb */}
                  <img
                    src={imgixThumb(asset.assets.image, 44, 44)}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className={`h-11 w-11 shrink-0 rounded-lg object-cover ${
                      isSelected ? "ring-2 ring-blue-500" : "ring-1 ring-black/5"
                    }`}
                  />
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {asset.title ?? asset.importedName ?? "Untitled"}
                  </span>
                </span>
                <span role="cell">{asset.size ? formatSize(asset.size) : "--"}</span>
                <span role="cell">{fmtDate(asset.createdAt)}</span>
                <span role="cell">{fmtDate(asset.updatedAt)}</span>
                <span role="cell">
                  {asset.width && asset.height ? `${asset.width} × ${asset.height}` : "--"}
                </span>
                <span role="cell" className="truncate">{asset.ext?.toLowerCase() ?? "--"}</span>
                <span role="cell" className="truncate">{asset.type}</span>
              </div>
            );
          })}
        </div>

        {isFetchingNextPage ? (
          <div className="py-4 text-center text-xs text-neutral-400">Loading more…</div>
        ) : null}
      </div>
    </div>
  );
}

const EMPTY: string[] = [];
