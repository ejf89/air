"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGalleryStore } from "@/lib/store";
import { downloadAssets } from "@/lib/actions";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, EllipsisIcon } from "./AssetMenu";

export interface SelectionBarProps {
  boardTitle: string;
}

/**
 * Air-style selection bar: full-width dark strip pinned to the bottom.
 * Left: clear (✕) + "N items selected from <board>". Right: overflow menu
 * and a prominent "Download all" button.
 */
export function SelectionBar({ boardTitle }: SelectionBarProps): JSX.Element | null {
  const count = useGalleryStore((s) => s.selectedIds.length);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

  if (count === 0) return null;

  const shareLink = () => {
    const s = useGalleryStore.getState();
    const urls = s.selectedIds
      .map((id) => s.assetById[id]?.assets.image)
      .filter(Boolean)
      .join("\n");
    try {
      void navigator.clipboard.writeText(urls);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <div className="fixed inset-x-2 bottom-2 z-40 sm:inset-x-4 sm:bottom-3">
      <div className="flex items-center gap-2 rounded-xl bg-neutral-800 px-2 py-2 text-white shadow-2xl sm:px-3">
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Clear selection"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {count} item{count === 1 ? "" : "s"} selected{" "}
          <span className="hidden text-neutral-400 sm:inline">from {boardTitle}</span>
        </span>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white"
            >
              <EllipsisIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" side="top" sideOffset={10} className={MENU_CONTENT_CLASS}>
              <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={shareLink}>
                Share a link
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          onClick={() => downloadAssets(useGalleryStore.getState().selectedIds)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
            <path d="M10 3.5v9m0 0 3.5-3.5M10 12.5 6.5 9M4 16.5h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download all
        </button>
      </div>
    </div>
  );
}
