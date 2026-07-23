"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Board } from "@/app/api/boards";
import { useGalleryStore } from "@/lib/store";
import { imgixThumb } from "@/lib/imgix";
import { BoardContextMenu, BoardEllipsisButton } from "./BoardMenu";

export interface BoardCardProps {
  board: Board;
}

/**
 * A sub-board card in the "Boards" row — matches Air's card style
 * (thumbnail, bottom gradient, white title). Doubles as the drop target
 * for dragging assets into the board.
 */
function BoardCardImpl({ board }: BoardCardProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: `board-drop-${board.id}` });
  const toggleExpanded = useGalleryStore((s) => s.toggleExpanded);
  const thumb = board.thumbnails?.[0];

  return (
    <BoardContextMenu boardId={board.id} boardTitle={board.title}>
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={() => toggleExpanded(board.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded(board.id);
          }
        }}
        className={`group relative aspect-[16/10] cursor-pointer select-none overflow-hidden rounded-xl bg-neutral-200 shadow-sm ring-1 ring-black/5 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isOver ? "-translate-y-0.5 shadow-lg ring-[3px] ring-blue-500" : ""
        }`}
      >
        {thumb ? (
          <img
            src={imgixThumb(thumb, 400, 250)}
            alt=""
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
              <path
                d="M2.5 5.5C2.5 4.67 3.17 4 4 4h3.67c.4 0 .78.16 1.06.44l.77.76c.28.28.66.44 1.06.44H16c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H4c-.83 0-1.5-.67-1.5-1.5v-8.5Z"
                fill="#CBD5E1"
              />
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <span className="pointer-events-none absolute bottom-2.5 left-3 right-9 truncate text-[15px] font-semibold tracking-[-0.01em] text-white drop-shadow-sm">
          {board.title}
        </span>

        {isOver ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-500/25">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow">
              Move here
            </span>
          </div>
        ) : null}

        <BoardEllipsisButton boardId={board.id} boardTitle={board.title} />
      </div>
    </BoardContextMenu>
  );
}

export const BoardCard = React.memo(BoardCardImpl);
BoardCard.displayName = "BoardCard";
