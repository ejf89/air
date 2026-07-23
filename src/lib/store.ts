import { create } from "zustand";
import { persist } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import type { Clip } from "@/app/api/clips";

interface GalleryState {
  // id -> full asset record, populated as pages load, independent of
  // which board currently "owns" the asset (see boardOverrides below).
  assetById: Record<string, Clip>;
  // boardId -> ordered list of asset ids currently displayed in that board.
  // Seeded from server order, then mutated locally by reorder/move (there is
  // no write endpoint in the given API, so this is the source of truth for
  // anything the user changes).
  orderByBoard: Record<string, string[]>;
  // assetId -> boardId, only present once a user has dragged it elsewhere.
  boardOverrides: Record<string, string>;
  expanded: Record<string, boolean>;
  selectedIds: string[];
  hoveredAssetId: string | null;
  lastSelectedId: string | null;

  upsertAssets: (clips: Clip[]) => void;
  ensureOrder: (boardId: string, ids: string[]) => void;
  reorder: (boardId: string, activeId: string, overId: string) => void;
  moveToBoard: (assetId: string, toBoardId: string) => void;
  moveManyToBoard: (assetIds: string[], toBoardId: string) => void;
  removeFromBoard: (assetIds: string[], boardId: string) => void;
  deleteAssets: (assetIds: string[]) => void;

  toggleExpanded: (boardId: string, defaultValue?: boolean) => void;
  isExpanded: (boardId: string, defaultValue: boolean) => boolean;

  setHovered: (id: string | null) => void;
  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectRange: (id: string, orderedIds: string[]) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      assetById: {},
      orderByBoard: {},
      boardOverrides: {},
      expanded: {},
      selectedIds: [],
      hoveredAssetId: null,
      lastSelectedId: null,

      upsertAssets: (clips) =>
        set((state) => {
          if (!clips.length) return state;
          const next = { ...state.assetById };
          for (const clip of clips) next[clip.id] = clip;
          return { assetById: next };
        }),

      ensureOrder: (boardId, ids) =>
        set((state) => {
          const existing = state.orderByBoard[boardId] ?? [];
          const existingSet = new Set(existing);
          const additions = ids.filter((id) => {
            const resolved = state.boardOverrides[id] ?? boardId;
            return resolved === boardId && !existingSet.has(id);
          });
          if (!additions.length) return state;
          return {
            orderByBoard: {
              ...state.orderByBoard,
              [boardId]: [...existing, ...additions],
            },
          };
        }),

      reorder: (boardId, activeId, overId) =>
        set((state) => {
          const list = state.orderByBoard[boardId];
          if (!list) return state;
          const from = list.indexOf(activeId);
          const to = list.indexOf(overId);
          if (from === -1 || to === -1 || from === to) return state;
          return {
            orderByBoard: {
              ...state.orderByBoard,
              [boardId]: arrayMove(list, from, to),
            },
          };
        }),

      moveToBoard: (assetId, toBoardId) => get().moveManyToBoard([assetId], toBoardId),

      moveManyToBoard: (assetIds, toBoardId) =>
        set((state) => {
          const orderByBoard = { ...state.orderByBoard };
          const boardOverrides = { ...state.boardOverrides };
          for (const assetId of assetIds) {
            for (const [bId, list] of Object.entries(orderByBoard)) {
              if (list.includes(assetId)) {
                orderByBoard[bId] = list.filter((id) => id !== assetId);
              }
            }
            boardOverrides[assetId] = toBoardId;
            const destination = orderByBoard[toBoardId] ?? [];
            if (!destination.includes(assetId)) {
              orderByBoard[toBoardId] = [assetId, ...destination];
            }
          }
          return { orderByBoard, boardOverrides, selectedIds: [] };
        }),

      removeFromBoard: (assetIds, boardId) =>
        set((state) => {
          const list = state.orderByBoard[boardId];
          if (!list) return state;
          const removeSet = new Set(assetIds);
          return {
            orderByBoard: {
              ...state.orderByBoard,
              [boardId]: list.filter((id) => !removeSet.has(id)),
            },
            selectedIds: state.selectedIds.filter((id) => !removeSet.has(id)),
          };
        }),

      deleteAssets: (assetIds) =>
        set((state) => {
          const removeSet = new Set(assetIds);
          const orderByBoard: Record<string, string[]> = {};
          for (const [boardId, list] of Object.entries(state.orderByBoard)) {
            orderByBoard[boardId] = list.filter((id) => !removeSet.has(id));
          }
          const assetById = { ...state.assetById };
          const boardOverrides = { ...state.boardOverrides };
          for (const id of assetIds) {
            delete assetById[id];
            delete boardOverrides[id];
          }
          return {
            orderByBoard,
            assetById,
            boardOverrides,
            selectedIds: state.selectedIds.filter((id) => !removeSet.has(id)),
          };
        }),

      toggleExpanded: (boardId, defaultValue = false) =>
        set((state) => ({
          expanded: { ...state.expanded, [boardId]: !(state.expanded[boardId] ?? defaultValue) },
        })),
      isExpanded: (boardId, defaultValue) => get().expanded[boardId] ?? defaultValue,

      setHovered: (id) => set({ hoveredAssetId: id }),

      select: (id) => set({ selectedIds: [id], lastSelectedId: id }),

      toggleSelect: (id) =>
        set((state) => {
          const has = state.selectedIds.includes(id);
          return {
            selectedIds: has
              ? state.selectedIds.filter((s) => s !== id)
              : [...state.selectedIds, id],
            lastSelectedId: id,
          };
        }),

      selectRange: (id, orderedIds) =>
        set((state) => {
          const anchor = state.lastSelectedId ?? id;
          const a = orderedIds.indexOf(anchor);
          const b = orderedIds.indexOf(id);
          if (a === -1 || b === -1) return { selectedIds: [id], lastSelectedId: id };
          const [start, end] = a < b ? [a, b] : [b, a];
          const range = orderedIds.slice(start, end + 1);
          const merged = new Set([...state.selectedIds, ...range]);
          return { selectedIds: Array.from(merged), lastSelectedId: id };
        }),

      setSelection: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),
    }),
    {
      name: "air-gallery-demo-state-v2",
      partialize: (state) => ({
        orderByBoard: state.orderByBoard,
        boardOverrides: state.boardOverrides,
        expanded: state.expanded,
      }),
    }
  )
);
