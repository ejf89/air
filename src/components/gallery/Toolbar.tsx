"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { SortField, SortFieldName } from "@/app/api/clips";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "./AssetMenu";

export type SortMode = { kind: "custom" } | { kind: "server"; field: SortField };

export const SORT_LABELS: Record<SortFieldName, string> = {
  dateModified: "Date modified",
  dateCreated: "Date created",
  dateTaken: "Date taken",
  name: "Name",
  size: "Size",
};

const SORT_OPTIONS: SortFieldName[] = [
  "dateModified",
  "dateCreated",
  "dateTaken",
  "name",
  "size",
];

export interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
}

/** Search + sort controls, styled after the reference board's header row. */
export function Toolbar({ search, onSearchChange, sort, onSortChange }: ToolbarProps): JSX.Element {
  const sortLabel = sort.kind === "custom" ? "Custom" : SORT_LABELS[sort.field.name];
  const direction = sort.kind === "server" ? sort.field.direction : null;

  return (
    <div className="mb-5 flex items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        >
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search assets…"
          aria-label="Search assets"
          className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 data-[state=open]:bg-neutral-100"
          >
            {sortLabel}
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-neutral-400">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className={MENU_CONTENT_CLASS}>
            <DropdownMenu.Item
              className={MENU_ITEM_CLASS}
              onSelect={() => onSortChange({ kind: "custom" })}
            >
              Custom
              {sort.kind === "custom" ? <Check /> : null}
            </DropdownMenu.Item>
            {SORT_OPTIONS.map((name) => (
              <DropdownMenu.Item
                key={name}
                className={MENU_ITEM_CLASS}
                onSelect={() =>
                  onSortChange({ kind: "server", field: { name, direction: "desc" } })
                }
              >
                {SORT_LABELS[name]}
                {sort.kind === "server" && sort.field.name === name ? <Check /> : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {direction ? (
        <button
          type="button"
          aria-label={`Sort ${direction === "desc" ? "descending" : "ascending"} — click to flip`}
          onClick={() =>
            sort.kind === "server" &&
            onSortChange({
              kind: "server",
              field: { ...sort.field, direction: direction === "desc" ? "asc" : "desc" },
            })
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className={direction === "asc" ? "rotate-180" : ""}
          >
            <path d="M8 3v10m0 0 3.5-3.5M8 13 4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="ml-auto text-blue-600">
      <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
