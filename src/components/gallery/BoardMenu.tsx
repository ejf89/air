"use client";

import * as React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGalleryStore } from "@/lib/store";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, EllipsisIcon } from "./AssetMenu";

export interface BoardMenuProps {
  boardId: string;
  boardTitle: string;
  children: React.ReactNode;
}

const MENU_SEPARATOR_CLASS = "mx-1.5 my-1 h-px bg-neutral-200";

function useBoardMenuLogic(boardId: string) {
  const selectionCount = useGalleryStore((s) => s.selectedIds.length);
  const moveManyToBoard = useGalleryStore((s) => s.moveManyToBoard);
  const toggleExpanded = useGalleryStore((s) => s.toggleExpanded);
  const expanded = useGalleryStore((s) => s.expanded[boardId] ?? false);

  const moveLabel = `Move ${selectionCount} ${selectionCount === 1 ? "asset" : "assets"} here`;

  const handleMoveSelectionHere = React.useCallback(() => {
    moveManyToBoard(useGalleryStore.getState().selectedIds, boardId);
  }, [moveManyToBoard, boardId]);

  const handleToggleOpen = React.useCallback(() => {
    toggleExpanded(boardId);
  }, [toggleExpanded, boardId]);

  return { selectionCount, moveLabel, expanded, handleMoveSelectionHere, handleToggleOpen };
}

interface BodyProps extends ReturnType<typeof useBoardMenuLogic> {
  Item: typeof ContextMenu.Item | typeof DropdownMenu.Item;
  Separator: typeof ContextMenu.Separator | typeof DropdownMenu.Separator;
}

function MenuBody({ Item, Separator, selectionCount, moveLabel, expanded, handleMoveSelectionHere, handleToggleOpen }: BodyProps) {
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
      <Item className={MENU_ITEM_CLASS} onSelect={handleToggleOpen}>
        {expanded ? "Collapse board" : "Expand board"}
      </Item>
    </>
  );
}

export function BoardContextMenu({ boardId, children }: BoardMenuProps): JSX.Element {
  const logic = useBoardMenuLogic(boardId);
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

export function BoardEllipsisButton({ boardId }: Omit<BoardMenuProps, "children">): JSX.Element {
  const logic = useBoardMenuLogic(boardId);
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
