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
import { AssetGrid } from "./AssetGrid";
import { BoardCard } from "./BoardCard";
import { Section } from "./Section";
import { SelectionBar } from "./SelectionBar";
import { Toolbar, type SortMode } from "./Toolbar";

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
  /** Server-fetched (ISR) first payloads — see app/page.tsx. */
  initialBoards?: BoardsListResponse;
  initialAssets?: ClipsListResponse;
}

export function Gallery({ initialBoards, initialAssets }: GalleryProps): JSX.Element {
  // One request for the root board's children — board cards must not wait
  // on a recursive tree walk (they're above-the-fold content). Seeded from
  // the ISR payload so cards paint immediately after hydration.
  const { data: boardsResponse, isLoading } = useQuery({
    queryKey: ["boards", ROOT_BOARD_ID],
    queryFn: () => fetchBoards(),
    staleTime: 5 * 60_000,
    initialData: initialBoards,
  });

  const boards = boardsResponse?.data ?? EMPTY_BOARDS;

  const rootChildren = React.useMemo(
    () =>
      boards
        .filter((b) => b.parentId === ROOT_BOARD_ID)
        .sort((a, b) => Number(a.pos) - Number(b.pos)),
    [boards]
  );

  const rootTitle =
    boards.find((b) => b.ancestors?.length)?.ancestors?.[0]?.title ?? "Gallery";

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

  // ---- page-level rubber-band selection -----------------------------------
  // Lasso can start ANYWHERE on the page (header, margins, boards row, on
  // unselected tiles) — only selected tiles (drag handles) and interactive
  // controls marked data-draggable="true" opt out.
  const [mainEl, setMainEl] = React.useState<HTMLDivElement | null>(null);
  const setSelection = useGalleryStore((s) => s.setSelection);

  const shiftLassoBaseRef = React.useRef<string[] | null>(null);
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
      // Box and tile rects are both viewport-relative and read live
      // mid-drag, so they intersect directly. Only mounted (visible +
      // overscan) tiles can match — fine for a visible-area gesture.
      const matched: string[] = [];
      tileRegistry.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (boxesIntersect(box, { left: r.left, top: r.top, width: r.width, height: r.height })) {
          matched.push(id);
        }
      });
      const base = shiftLassoBaseRef.current;
      setSelection(base ? Array.from(new Set([...base, ...matched])) : matched);
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
    [reorder, moveManyToBoard]
  );

  // NOTE: no early return while the board tree loads — the assets wall
  // fetches independently and must not be serialized behind the boards
  // BFS (it's the LCP content). The boards section shows its own skeleton.
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        ref={setMainEl}
        onPointerDownCapture={handlePointerDownCapture}
        onClick={(e) => {
          if (e.target === e.currentTarget) clearSelection();
        }}
        className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8"
      >
        <DragSelection />
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{rootTitle}</h1>
        </header>

        <Toolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          sort={sort}
          onSortChange={setSort}
        />

        {isSearching ? (
          // Search results are a flat view across the whole board tree,
          // like the reference site's ?q= mode.
          <Section storeKey="section:results" title={`Results for “${search}”`}>
            <AssetGrid
              boardId={ROOT_BOARD_ID}
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
            <Section
              storeKey="section:boards"
              title="Boards"
              count={rootChildren.length || undefined}
            >
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="aspect-[16/10] animate-pulse rounded-xl bg-neutral-100" />
                    ))
                  : rootChildren.map((b) => <BoardCard key={b.id} board={b} />)}
              </div>
            </Section>

            <Section storeKey="section:assets" title="Assets">
              <AssetGrid
                boardId={ROOT_BOARD_ID}
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

      <SelectionBar boardTitle={rootTitle} />

      <DragOverlay dropAnimation={null}>
        {activeAsset ? (
          <div className="relative h-24 w-24 rotate-2 overflow-hidden rounded-lg shadow-2xl ring-2 ring-blue-500">
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
