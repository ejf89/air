"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useSelectionContainer, boxesIntersect } from "react-drag-to-select";
import { fetchBoards, ROOT_BOARD_ID, type Board, type BoardsListResponse } from "@/app/api/boards";
import type { Clip, ClipsListResponse } from "@/app/api/clips";
import { useGalleryStore } from "@/lib/store";
import { tileRegistry } from "@/lib/tileRegistry";
import { imgixThumb } from "@/lib/imgix";
import Link from "next/link";
import { AssetGrid } from "./AssetGrid";
import { BoardCard } from "./BoardCard";
import { Section } from "./Section";
import { SelectionBar } from "./SelectionBar";
import { Toast } from "./Toast";
import { SearchBox, SortControls, type SortMode } from "./Toolbar";
import { boardHref, type Crumb } from "./BoardMenu";

const BOARD_DROP_PREFIX = "board-drop-";
const ASSET_DROP_PREFIX = "asset-drop-";

/**
 * Air's interaction model, enforced from the dnd side: a drag only starts
 * on an already-SELECTED tile. Dragging anywhere else — empty space or an
 * unselected tile — is a rubber-band selection (the tile's data-draggable
 * attribute mirrors the same rule for react-drag-to-select). Modified
 * presses (shift = additive lasso, cmd/ctrl = toggle-select) never drag.
 */
class GalleryPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: React.PointerEvent): boolean => {
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        if (nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) return false;
        const tile = (nativeEvent.target as HTMLElement).closest<HTMLElement>("[data-asset-id]");
        if (!tile) return false;
        const id = tile.dataset.assetId;
        return id ? useGalleryStore.getState().selectedSet.has(id) : false;
      },
    },
  ];
}

export interface GalleryProps {
  /** Board to display — the root board by default; sub-board pages pass
   *  their own id (see app/b/[boardId]/page.tsx). */
  boardId?: string;
  /** Title carried through navigation so the header paints instantly. */
  title?: string;
  /** Navigation path (root → parent) carried through links — the ancestry
   *  fallback for leaf boards, which the API can't report ancestors for. */
  navPath?: Crumb[];
  /** Server-fetched (ISR) first payloads — see app/page.tsx. */
  initialBoards?: BoardsListResponse;
  initialAssets?: ClipsListResponse;
}

export function Gallery({
  boardId = ROOT_BOARD_ID,
  title,
  navPath,
  initialBoards,
  initialAssets,
}: GalleryProps): JSX.Element {
  const isRoot = boardId === ROOT_BOARD_ID;

  // One request for this board's children — board cards must not wait on a
  // recursive tree walk (they're above-the-fold content). Seeded from the
  // ISR payload on the root page so cards paint immediately after hydration.
  const { data: boardsResponse, isLoading } = useQuery({
    queryKey: ["boards", boardId],
    queryFn: () => fetchBoards(boardId),
    staleTime: 5 * 60_000,
    initialData: initialBoards,
  });

  const boards = boardsResponse?.data ?? EMPTY_BOARDS;

  const childBoards = React.useMemo(
    () =>
      boards
        .filter((b) => b.parentId === boardId)
        .sort((a, b) => Number(a.pos) - Number(b.pos)),
    [boards, boardId]
  );

  // Any child's ancestors array is the full path root → … → current board
  // (ids + titles), which gives us both the title and real breadcrumbs.
  const ancestorChain = boards.find((b) => b.ancestors?.length)?.ancestors;

  const boardTitle =
    title ??
    ancestorChain?.find((a) => a.id === boardId)?.title ??
    (isRoot ? "Air Branded Boards" : "Board");

  // Path above the current board, for the breadcrumb row: the API's
  // ancestor chain is the source of truth when this board has children;
  // otherwise the path the user navigated through (carried in the URL).
  const breadcrumbs = React.useMemo(() => {
    if (isRoot) return [];
    if (ancestorChain) return ancestorChain.filter((a) => a.id !== boardId);
    return navPath ?? [];
  }, [isRoot, ancestorChain, boardId, navPath]);

  // What children of this board inherit as THEIR path.
  const childPath = React.useMemo(
    () => [...breadcrumbs, { id: boardId, title: boardTitle }],
    [breadcrumbs, boardId, boardTitle]
  );

  // Back target = immediate parent (last breadcrumb); root as fallback.
  const parent = breadcrumbs[breadcrumbs.length - 1];
  const parentHref =
    !parent || parent.id === ROOT_BOARD_ID
      ? "/"
      : boardHref(parent.id, parent.title, breadcrumbs.slice(0, -1));

  const reorder = useGalleryStore((s) => s.reorder);
  const moveManyToBoard = useGalleryStore((s) => s.moveManyToBoard);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

  // ---- search + sort ------------------------------------------------------
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortMode>({ kind: "custom" });

  // Debounce keystrokes so we don't hammer the API mid-word.
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isSearching = search.length > 0;
  const serverSort = sort.kind === "server" ? sort.field : undefined;
  const serverMode = isSearching || sort.kind === "server";

  // Esc anywhere clears the current selection.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const [activeAsset, setActiveAsset] = React.useState<Clip | null>(null);
  const [activeCount, setActiveCount] = React.useState(1);
  const [assetTotal, setAssetTotal] = React.useState<number | undefined>(
    initialAssets?.data.total
  );

  // ---- page-level rubber-band selection -----------------------------------
  // Lasso can start ANYWHERE on the page (header, margins, boards row, on
  // unselected tiles) — only selected tiles (drag handles) and interactive
  // controls marked data-draggable="true" opt out.
  const [mainEl, setMainEl] = React.useState<HTMLDivElement | null>(null);
  const setSelection = useGalleryStore((s) => s.setSelection);

  const shiftLassoBaseRef = React.useRef<string[] | null>(null);
  // A lasso release fires a click on the common ancestor of press/release
  // targets — i.e. the page container itself — which is indistinguishable
  // from a plain "click empty space" without tracking the gesture. Suppress
  // exactly one clear after any real drag gesture (lasso or dnd).
  const lassoMovedRef = React.useRef(false);
  const suppressNextClearRef = React.useRef(false);
  const handlePointerDownCapture = React.useCallback((e: React.PointerEvent) => {
    if (!e.shiftKey) {
      shiftLassoBaseRef.current = null;
      return;
    }
    // Shift+lasso adds to the selection captured at gesture start. Selected
    // tiles carry data-draggable="true" (they're drag handles), which blocks
    // the selection library — flip the pressed one off for the gesture so
    // shift+drag lassoes from anywhere, restoring by selection state after.
    shiftLassoBaseRef.current = useGalleryStore.getState().selectedIds;
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-asset-id][data-draggable="true"]');
    if (!tile) return;
    tile.dataset.draggable = "false";
    const restore = () => {
      const id = tile.dataset.assetId;
      tile.dataset.draggable =
        id && useGalleryStore.getState().selectedSet.has(id) ? "true" : "false";
      window.removeEventListener("pointerup", restore);
      window.removeEventListener("pointercancel", restore);
    };
    window.addEventListener("pointerup", restore);
    window.addEventListener("pointercancel", restore);
  }, []);

  const { DragSelection } = useSelectionContainer({
    eventsElement: mainEl,
    onSelectionChange: (box) => {
      // Verified empirically: the library reports the box in raw viewport
      // coordinates (clientX/Y), so it intersects directly with live
      // getBoundingClientRect()s. The marquee itself must therefore be
      // drawn in a viewport-origin layer — see the fixed wrapper below.
      // Only mounted (visible + overscan) tiles can match — fine for a
      // visible-area gesture.
      const matched: string[] = [];
      tileRegistry.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (boxesIntersect(box, { left: r.left, top: r.top, width: r.width, height: r.height })) {
          matched.push(id);
        }
      });
      if (box.width * box.height > 9) lassoMovedRef.current = true;
      const base = shiftLassoBaseRef.current;
      setSelection(base ? Array.from(new Set([...base, ...matched])) : matched);
    },
    onSelectionEnd: () => {
      if (lassoMovedRef.current) suppressNextClearRef.current = true;
      lassoMovedRef.current = false;
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

  // 8px activation distance keeps plain clicks (select) and drags distinct.
  const sensors = useSensors(
    useSensor(GalleryPointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const state = useGalleryStore.getState();
    setActiveAsset(state.assetById[id] ?? null);
    setActiveCount(
      state.selectedIds.includes(id) ? Math.max(state.selectedIds.length, 1) : 1
    );
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveAsset(null);
      suppressNextClearRef.current = true;
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const state = useGalleryStore.getState();

      if (overId.startsWith(BOARD_DROP_PREFIX)) {
        // Dropping onto a board card moves the dragged asset — or the whole
        // selection, if the dragged asset is part of one.
        const targetBoardId = overId.slice(BOARD_DROP_PREFIX.length);
        const ids =
          state.selectedIds.includes(activeId) && state.selectedIds.length > 1
            ? state.selectedIds
            : [activeId];
        moveManyToBoard(ids, targetBoardId);
        const targetTitle =
          childBoards.find((b) => b.id === targetBoardId)?.title ?? "board";
        state.showToast(
          `Moved ${ids.length} asset${ids.length === 1 ? "" : "s"} to ${targetTitle}`
        );
        return;
      }

      if (overId.startsWith(ASSET_DROP_PREFIX)) {
        const overAssetId = overId.slice(ASSET_DROP_PREFIX.length);
        if (overAssetId === activeId) return;
        const sourceBoardId = Object.entries(state.orderByBoard).find(([, list]) =>
          list.includes(activeId)
        )?.[0];
        if (!sourceBoardId) return;
        // Dragging one tile of a multi-selection reorders the whole group —
        // but only the part of the selection living in the same board.
        const group =
          state.selectedIds.includes(activeId) && state.selectedIds.length > 1
            ? state.selectedIds.filter((id) =>
                state.orderByBoard[sourceBoardId]?.includes(id)
              )
            : [activeId];
        reorder(sourceBoardId, group.length ? group : [activeId], overAssetId);
      }
    },
    [reorder, moveManyToBoard, childBoards]
  );

  // NOTE: no early return while the boards load — the assets wall fetches
  // independently and must not be serialized behind it (it's LCP content).
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Top app bar: brand left, search centered — like the reference. */}
      <div className="sticky top-0 z-30 bg-neutral-100/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-[13px] font-bold italic text-white">
              a
            </span>
            <span className="hidden truncate text-[15px] font-semibold text-neutral-900 md:block">
              Air Branded Boards
            </span>
          </Link>
          <div className="mx-auto w-full max-w-xl">
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              placeholder={`Search ${boardTitle}`}
            />
          </div>
          <div className="hidden w-7 shrink-0 md:block lg:w-40" />
        </div>
      </div>

      <div
        ref={setMainEl}
        onPointerDownCapture={handlePointerDownCapture}
        onClick={(e) => {
          if (suppressNextClearRef.current) {
            suppressNextClearRef.current = false;
            return;
          }
          if (e.target === e.currentTarget) clearSelection();
        }}
        className="relative mx-auto mb-6 max-w-[1500px] rounded-2xl bg-white px-4 py-5 shadow-sm ring-1 ring-black/5 sm:mx-4 sm:px-6 lg:mx-auto lg:px-8"
      >
        {/* Marquee layer: the library positions the drawn box using viewport
            coordinates relative to this element's parent, so the parent must
            sit at the viewport origin or the visible rectangle is displaced
            from the cursor. */}
        <div className="pointer-events-none fixed inset-0 z-30">
          <DragSelection />
        </div>

        {/* Content header: breadcrumbs + title left, sort controls right. */}
        <header className="mb-4">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[13px] text-neutral-600">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="shrink-0 text-neutral-500">
              <rect x="3" y="3.5" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 7h14" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {[...(isRoot ? [] : breadcrumbs.length ? breadcrumbs : [{ id: ROOT_BOARD_ID, title: "Air Branded Boards" }]), null].map(
              (crumb, i, arr) =>
                crumb ? (
                  <React.Fragment key={crumb.id}>
                    <Link
                      href={
                        crumb.id === ROOT_BOARD_ID
                          ? "/"
                          : boardHref(crumb.id, crumb.title, breadcrumbs.slice(0, i))
                      }
                      className="max-w-[180px] truncate rounded px-0.5 py-0.5 transition-colors hover:text-neutral-900 hover:underline"
                    >
                      {crumb.title}
                    </Link>
                    <span className="text-neutral-300">/</span>
                  </React.Fragment>
                ) : (
                  <span key="current" className="truncate font-medium text-neutral-900">
                    {boardTitle}
                  </span>
                )
            )}
          </nav>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {!isRoot ? (
                <Link
                  href={parentHref}
                  aria-label="Back to parent board"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : null}
              <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
                {boardTitle}
              </h1>
            </div>
            <SortControls sort={sort} onSortChange={setSort} />
          </div>
          <div className="-mx-4 mt-4 border-b border-neutral-200/80 sm:-mx-6 lg:-mx-8" />
        </header>

        {isSearching ? (
          // Search results are a flat view across this board's whole
          // subtree, like the reference site's ?q= mode.
          <Section storeKey="section:results" title={`Results for “${search}”`}>
            <AssetGrid
              boardId={boardId}
              queryOptions={{
                search,
                sortField: serverSort,
                includeDescendants: true,
                serverMode: true,
              }}
              emptyMessage={`No assets matching “${search}”.`}
            />
          </Section>
        ) : (
          <>
            {isLoading || childBoards.length ? (
              <Section
                storeKey="section:boards"
                title="Boards"
                count={childBoards.length || undefined}
              >
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="aspect-[16/10] animate-pulse rounded-xl bg-neutral-100" />
                      ))
                    : childBoards.map((b) => <BoardCard key={b.id} board={b} path={childPath} />)}
                </div>
              </Section>
            ) : null}

            <Section storeKey="section:assets" title="Assets" count={assetTotal}>
              <AssetGrid
                boardId={boardId}
                onTotalChange={setAssetTotal}
                queryOptions={
                  serverMode
                    ? { sortField: serverSort, serverMode }
                    : { initialData: initialAssets }
                }
              />
            </Section>
          </>
        )}
      </div>

      <SelectionBar boardTitle={boardTitle} />
      <Toast />

      <DragOverlay dropAnimation={null}>
        {activeAsset ? (
          <div className="relative h-24 w-24 rotate-2 overflow-hidden rounded-lg shadow-2xl ring-2 ring-blue-500">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny transient drag ghost */}
            <img
              src={imgixThumb(activeAsset.assets.image, 96, 96)}
              alt=""
              className="h-full w-full object-cover"
            />
            {activeCount > 1 ? (
              <div className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
                {activeCount}
              </div>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const EMPTY_BOARDS: Board[] = [];
