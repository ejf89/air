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
import { fetchBoardTree, ROOT_BOARD_ID, type Board } from "@/app/api/boards";
import type { Clip } from "@/app/api/clips";
import { useGalleryStore } from "@/lib/store";
import { imgixThumb } from "@/lib/imgix";
import { AssetGrid } from "./AssetGrid";
import { BoardCard } from "./BoardCard";
import { Section } from "./Section";
import { SelectionBar } from "./SelectionBar";

const BOARD_DROP_PREFIX = "board-drop-";
const ASSET_DROP_PREFIX = "asset-drop-";

/**
 * PointerSensor that ignores shift/cmd-modified presses: shift+drag is the
 * lasso gesture (see AssetGrid), and cmd+click toggles selection — neither
 * should ever start an asset drag.
 */
class GalleryPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: React.PointerEvent): boolean => {
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        if (nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) return false;
        return true;
      },
    },
  ];
}

export function Gallery(): JSX.Element {
  const { data: allBoards, isLoading } = useQuery({
    queryKey: ["boardTree"],
    queryFn: () => fetchBoardTree(),
    staleTime: 5 * 60_000,
  });

  const boards = allBoards ?? EMPTY_BOARDS;

  const rootChildren = React.useMemo(
    () =>
      boards
        .filter((b) => b.parentId === ROOT_BOARD_ID)
        .sort((a, b) => Number(a.pos) - Number(b.pos)),
    [boards]
  );

  const rootTitle =
    boards.find((b) => b.ancestors?.length)?.ancestors?.[0]?.title ?? "Gallery";

  // Board panels the user has expanded (from the card / its menu).
  const expandedMap = useGalleryStore((s) => s.expanded);
  const openBoards = React.useMemo(
    () => rootChildren.filter((b) => expandedMap[b.id]),
    [rootChildren, expandedMap]
  );

  const reorder = useGalleryStore((s) => s.reorder);
  const moveManyToBoard = useGalleryStore((s) => s.moveManyToBoard);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

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
        if (sourceBoardId) reorder(sourceBoardId, activeId, overAssetId);
      }
    },
    [reorder, moveManyToBoard]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-neutral-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-md bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{rootTitle}</h1>
        </header>

        {rootChildren.length ? (
          <Section storeKey="section:boards" title="Boards" count={rootChildren.length}>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {rootChildren.map((b) => (
                <BoardCard key={b.id} board={b} />
              ))}
            </div>

            {openBoards.map((b) => (
              <div key={b.id} className="mb-4 rounded-xl border border-neutral-200/70 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-neutral-800">{b.title}</h3>
                  <button
                    type="button"
                    onClick={() => useGalleryStore.getState().toggleExpanded(b.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                    aria-label={`Collapse ${b.title}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <AssetGrid boardId={b.id} />
              </div>
            ))}
          </Section>
        ) : null}

        <Section storeKey="section:assets" title="Assets">
          <AssetGrid boardId={ROOT_BOARD_ID} />
        </Section>
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
