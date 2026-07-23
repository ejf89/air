"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGalleryStore } from "@/lib/store";
import { downloadAssets } from "@/lib/actions";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "./AssetMenu";

export interface SelectionBarProps {
  boards: { id: string; title: string }[];
}

/**
 * Floating pill at the bottom of the viewport whenever a selection is
 * active — mirrors Air's "N selected" bar. Fully-functional actions only:
 * download, move to a board, clear.
 */
export function SelectionBar({ boards }: SelectionBarProps): JSX.Element | null {
  const count = useGalleryStore((s) => s.selectedIds.length);
  const clearSelection = useGalleryStore((s) => s.clearSelection);
  const moveManyToBoard = useGalleryStore((s) => s.moveManyToBoard);

  const sortedBoards = React.useMemo(
    () => boards.slice().sort((a, b) => a.title.localeCompare(b.title)),
    [boards]
  );

  if (count === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full bg-neutral-900 py-1.5 pl-4 pr-1.5 text-white shadow-2xl">
        <span className="mr-2 whitespace-nowrap text-sm font-medium tabular-nums">
          {count} selected
        </span>

        <button
          type="button"
          onClick={() => downloadAssets(useGalleryStore.getState().selectedIds)}
          className="rounded-full px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          Download
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white"
            >
              Move to…
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="center" side="top" sideOffset={8} className={MENU_CONTENT_CLASS}>
              {sortedBoards.map((b) => (
                <DropdownMenu.Item
                  key={b.id}
                  className={MENU_ITEM_CLASS}
                  onSelect={() => moveManyToBoard(useGalleryStore.getState().selectedIds, b.id)}
                >
                  {b.title}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          onClick={clearSelection}
          aria-label="Clear selection"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
