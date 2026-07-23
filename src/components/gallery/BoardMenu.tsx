"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGalleryStore } from "@/lib/store";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, EllipsisIcon } from "./AssetMenu";

export interface BoardMenuProps {
  boardId: string;
  boardTitle: string;
  /** Navigation path from root down to (excluding) this board. */
  path: Crumb[];
  children: React.ReactNode;
}

const MENU_SEPARATOR_CLASS = "mx-1.5 my-1 h-px bg-neutral-200";

export interface Crumb {
  id: string;
  title: string;
}

/** In-app route for a board's gallery view. Title AND the navigation path
 *  ride along, so breadcrumbs/back work even on leaf boards where the API
 *  can't tell us the ancestry (it only comes back on boards WITH children). */
export function boardHref(boardId: string, boardTitle: string, path: Crumb[] = []) {
  const params = new URLSearchParams({ title: boardTitle });
  if (path.length) params.set("path", JSON.stringify(path));
  return `/b/${boardId}?${params.toString()}`;
}

function useBoardMenuLogic(boardId: string, boardTitle: string, path: Crumb[]) {
  const router = useRouter();
  const selectionCount = useGalleryStore((s) => s.selectedIds.length);
  const moveManyToBoard = useGalleryStore((s) => s.moveManyToBoard);

  const moveLabel = `Move ${selectionCount} ${selectionCount === 1 ? "asset" : "assets"} here`;

  const handleMoveSelectionHere = React.useCallback(() => {
    const state = useGalleryStore.getState();
    const count = state.selectedIds.length;
    moveManyToBoard(state.selectedIds, boardId);
    state.showToast(
      `Moved ${count} asset${count === 1 ? "" : "s"} to ${boardTitle}`
    );
  }, [moveManyToBoard, boardId, boardTitle]);

  const handleOpen = React.useCallback(
    () => router.push(boardHref(boardId, boardTitle, path)),
    [router, boardId, boardTitle, path]
  );

  return { selectionCount, moveLabel, handleMoveSelectionHere, handleOpen };
}

interface BodyProps extends ReturnType<typeof useBoardMenuLogic> {
  Item: typeof ContextMenu.Item | typeof DropdownMenu.Item;
  Separator: typeof ContextMenu.Separator | typeof DropdownMenu.Separator;
}

function MenuBody({ Item, Separator, selectionCount, moveLabel, handleMoveSelectionHere, handleOpen }: BodyProps) {
  return (
    <>
      {selectionCount > 0 ? (
        <>
          <Item className={MENU_ITEM_CLASS} onSelect={handleMoveSelectionHere}>
            {moveLabel}
          </Item>
          <Separator className={MENU_SEPARATOR_CLASS} />
        </>
      ) : null}
      <Item className={MENU_ITEM_CLASS} onSelect={handleOpen}>
        Open board
      </Item>
    </>
  );
}

export function BoardContextMenu({ boardId, boardTitle, path, children }: BoardMenuProps): JSX.Element {
  const logic = useBoardMenuLogic(boardId, boardTitle, path);
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={MENU_CONTENT_CLASS} onClick={(e) => e.stopPropagation()}>
          <MenuBody Item={ContextMenu.Item} Separator={ContextMenu.Separator} {...logic} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function BoardEllipsisButton({ boardId, boardTitle, path }: Omit<BoardMenuProps, "children">): JSX.Element {
  const logic = useBoardMenuLogic(boardId, boardTitle, path);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Board actions"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-neutral-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
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
          <MenuBody Item={DropdownMenu.Item} Separator={DropdownMenu.Separator} {...logic} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
