import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import type { Clip } from "@/app/api/clips";

/**
 * localStorage wrapper with a trailing-debounced setItem: persist runs on
 * EVERY store write, and rubber-band drags update the selection per
 * (throttled) mousemove — without this, each tick pays a synchronous
 * JSON.stringify + localStorage write on the main thread. Flushes on
 * pagehide so nothing is lost on tab close.
 */
function createDebouncedStorage(delayMs: number): Storage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: [string, string] | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) {
      try {
        window.localStorage.setItem(pending[0], pending[1]);
      } catch {
        // storage full/unavailable — nothing useful to do
      }
      pending = null;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
  }

  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => {
      pending = [key, value];
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (key) => {
      pending = null;
      window.localStorage.removeItem(key);
    },
    get length() {
      return window.localStorage.length;
    },
    clear: () => window.localStorage.clear(),
    key: (i) => window.localStorage.key(i),
  };
}

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
  viewMode: "gallery" | "table";
  selectedIds: string[];
  // Mirror of selectedIds for O(1) membership checks — every mounted tile
  // subscribes to membership, and rubber-band drags update selection on
  // every (throttled) mousemove, so .includes() over an array would be
  // O(selection) x tiles x frames under CPU throttle.
  selectedSet: Set<string>;
  hoveredAssetId: string | null;
  lastSelectedId: string | null;

  upsertAssets: (clips: Clip[]) => void;
  ensureOrder: (boardId: string, ids: string[]) => void;
  reorder: (boardId: string, activeIds: string[], overId: string) => void;
  moveManyToBoard: (assetIds: string[], toBoardId: string) => void;
  removeFromBoard: (assetIds: string[], boardId: string) => void;
  deleteAssets: (assetIds: string[]) => void;

  toggleExpanded: (boardId: string, defaultValue?: boolean) => void;
  setViewMode: (mode: "gallery" | "table") => void;

  toast: { message: string; key: number } | null;
  showToast: (message: string) => void;
  clearToast: () => void;

  setHovered: (id: string | null) => void;
  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectRange: (id: string, orderedIds: string[]) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
}

const sel = (ids: string[]) => ({ selectedIds: ids, selectedSet: new Set(ids) });

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set) => ({
      assetById: {},
      orderByBoard: {},
      boardOverrides: {},
      expanded: {},
      viewMode: "gallery",
      ...sel([]),
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

      // Reorder one or many: the dragged group is pulled out of the list and
      // re-inserted as a contiguous block at the drop target's position.
      reorder: (boardId, activeIds, overId) =>
        set((state) => {
          const list = state.orderByBoard[boardId];
          if (!list || activeIds.includes(overId)) return state;
          if (activeIds.length === 1) {
            const from = list.indexOf(activeIds[0]);
            const to = list.indexOf(overId);
            if (from === -1 || to === -1 || from === to) return state;
            return {
              orderByBoard: { ...state.orderByBoard, [boardId]: arrayMove(list, from, to) },
            };
          }
          const moving = new Set(activeIds);
          const remaining = list.filter((id) => !moving.has(id));
          const insertAt = remaining.indexOf(overId);
          if (insertAt === -1) return state;
          const block = list.filter((id) => moving.has(id));
          const next = [
            ...remaining.slice(0, insertAt),
            ...block,
            ...remaining.slice(insertAt),
          ];
          return { orderByBoard: { ...state.orderByBoard, [boardId]: next } };
        }),

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
          return { orderByBoard, boardOverrides, ...sel([]) };
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
            ...sel(state.selectedIds.filter((id) => !removeSet.has(id))),
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
            ...sel(state.selectedIds.filter((id) => !removeSet.has(id))),
          };
        }),

      toggleExpanded: (boardId, defaultValue = false) =>
        set((state) => ({
          expanded: { ...state.expanded, [boardId]: !(state.expanded[boardId] ?? defaultValue) },
        })),

      setViewMode: (mode) => set({ viewMode: mode }),

      toast: null,
      showToast: (message) =>
        set((state) => ({ toast: { message, key: (state.toast?.key ?? 0) + 1 } })),
      clearToast: () => set({ toast: null }),

      setHovered: (id) => set({ hoveredAssetId: id }),

      select: (id) => set({ ...sel([id]), lastSelectedId: id }),

      toggleSelect: (id) =>
        set((state) => {
          const has = state.selectedIds.includes(id);
          return {
            ...sel(
              has
                ? state.selectedIds.filter((s) => s !== id)
                : [...state.selectedIds, id]
            ),
            lastSelectedId: id,
          };
        }),

      selectRange: (id, orderedIds) =>
        set((state) => {
          const anchor = state.lastSelectedId ?? id;
          const a = orderedIds.indexOf(anchor);
          const b = orderedIds.indexOf(id);
          if (a === -1 || b === -1) return { ...sel([id]), lastSelectedId: id };
          const [start, end] = a < b ? [a, b] : [b, a];
          const range = orderedIds.slice(start, end + 1);
          const merged = new Set([...state.selectedIds, ...range]);
          return { ...sel(Array.from(merged)), lastSelectedId: id };
        }),

      setSelection: (ids) => set(sel(ids)),
      clearSelection: () => set(sel([])),
    }),
    {
      name: "air-gallery-demo-state-v2",
      storage: createJSONStorage(() => createDebouncedStorage(500)),
      partialize: (state) => ({
        orderByBoard: state.orderByBoard,
        boardOverrides: state.boardOverrides,
        expanded: state.expanded,
        viewMode: state.viewMode,
      }),
    }
  )
);
