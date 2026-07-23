"use client";

import * as React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGalleryStore } from "@/lib/store";
import { downloadAssets } from "@/lib/actions";

export interface AssetMenuProps {
  assetId: string;
  children: React.ReactNode;
}

// Shared visual classes — kept identical with BoardMenu.tsx.
export const MENU_CONTENT_CLASS =
  "z-50 min-w-[220px] rounded-xl border border-neutral-200 bg-white py-1.5 shadow-xl";
export const MENU_ITEM_CLASS =
  "mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-neutral-900 outline-none hover:bg-neutral-100 focus:bg-neutral-100 data-[disabled]:pointer-events-none data-[disabled]:text-neutral-300";
export const MENU_LABEL_CLASS =
  "px-4 pb-1 pt-1.5 text-xs font-medium text-neutral-400 select-none";

function OpenIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" className="shrink-0 text-neutral-700">
      <path d="M12 4h4v4M16 4l-6 6M8 5H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" className="shrink-0 text-neutral-700">
      <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.54 3.54 0 0 0-5-5L9.75 5.25M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.54 3.54 0 0 0 5 5l1.25-1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" className="shrink-0 text-neutral-700">
      <rect x="7" y="7" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" className="shrink-0 text-neutral-700">
      <path d="M10 3.5v9m0 0 3.5-3.5M10 12.5 6.5 9M4 16.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

/**
 * Same four actions as Air's real public-board menu (Open, Share a link,
 * Copy to Air workspace, Download) — deliberately no invented extras.
 * When the clicked asset is part of a multi-selection, actions apply to the
 * whole selection and labels say so.
 */
function useAssetMenuLogic(assetId: string) {
  const isInSelection = useGalleryStore(
    (s) => s.selectedSet.has(assetId) && s.selectedIds.length > 1
  );
  const count = useGalleryStore((s) =>
    s.selectedSet.has(assetId) && s.selectedIds.length > 1 ? s.selectedIds.length : 1
  );

  const getTargets = React.useCallback(() => {
    const s = useGalleryStore.getState();
    return s.selectedIds.includes(assetId) && s.selectedIds.length > 1
      ? s.selectedIds
      : [assetId];
  }, [assetId]);

  const handleOpen = React.useCallback(() => {
    const asset = useGalleryStore.getState().assetById[assetId];
    if (!asset) return;
    window.open(asset.assets.original ?? asset.assets.image, "_blank", "noopener,noreferrer");
  }, [assetId]);

  const handleShareLink = React.useCallback(() => {
    const s = useGalleryStore.getState();
    const urls = getTargets()
      .map((id) => s.assetById[id]?.assets.image)
      .filter(Boolean)
      .join("\n");
    try {
      void navigator.clipboard.writeText(urls);
    } catch {
      // clipboard can throw in insecure contexts — silently no-op
    }
  }, [getTargets]);

  const handleCopyToWorkspace = React.useCallback(() => {
    // Same as the reference public board: prompts you into Air itself.
    window.open("https://air.inc/signup", "_blank", "noopener,noreferrer");
  }, []);

  const handleDownload = React.useCallback(() => {
    downloadAssets(getTargets());
  }, [getTargets]);

  return { isInSelection, count, handleOpen, handleShareLink, handleCopyToWorkspace, handleDownload };
}

interface MenuBodyProps extends ReturnType<typeof useAssetMenuLogic> {
  Item: typeof ContextMenu.Item | typeof DropdownMenu.Item;
}

function MenuBody({ Item, isInSelection, count, handleOpen, handleShareLink, handleCopyToWorkspace, handleDownload }: MenuBodyProps) {
  const suffix = isInSelection ? ` ${count} assets` : "";
  return (
    <>
      {isInSelection ? <div className={MENU_LABEL_CLASS}>{count} assets selected</div> : null}
      {!isInSelection ? (
        <Item className={MENU_ITEM_CLASS} onSelect={handleOpen}>
          <OpenIcon /> Open
        </Item>
      ) : null}
      <Item className={MENU_ITEM_CLASS} onSelect={handleShareLink}>
        <LinkIcon /> Share a link
      </Item>
      <Item className={MENU_ITEM_CLASS} onSelect={handleCopyToWorkspace}>
        <CopyIcon /> Copy to Air workspace
      </Item>
      <Item className={MENU_ITEM_CLASS} onSelect={handleDownload}>
        <DownloadIcon /> Download{suffix}
      </Item>
    </>
  );
}

export function AssetContextMenu({ assetId, children }: AssetMenuProps): JSX.Element {
  const logic = useAssetMenuLogic(assetId);
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={MENU_CONTENT_CLASS} onClick={(e) => e.stopPropagation()}>
          <MenuBody Item={ContextMenu.Item} {...logic} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function AssetEllipsisButton({ assetId }: Omit<AssetMenuProps, "children">): JSX.Element {
  const logic = useAssetMenuLogic(assetId);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="More actions"
          className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800/90 text-white opacity-0 shadow-sm transition-opacity hover:bg-neutral-900 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
        >
          <EllipsisIcon />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={MENU_CONTENT_CLASS}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuBody Item={DropdownMenu.Item} {...logic} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
